import fs from 'node:fs';
import path from 'node:path';

/**
 * Escapes a string for double-quoted YAML scalar values.
 */
function yamlStr(val) {
  return `"${String(val ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
}

/**
 * Strips any local origin prefix from URLs so paths remain portable.
 */
function normalizeSrc(src) {
  if (!src) return '';
  return src.replace(/^https?:\/\/localhost:\d+/i, '');
}

/**
 * Saves an uploaded base64 dataUrl to `public/images/uploads/<slug>/<filename>`
 * and returns the public URL path.
 */
function persistDataUrl(rootDir, slug, frame, index) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(frame.dataUrl || '');
  if (!match) return normalizeSrc(frame.src);

  const mime = match[1].toLowerCase();
  const base64Data = match[2];
  const ext = mime.includes('svg') ? 'svg' : mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';

  const rawName = (frame.fileName || `frame-${index + 1}.${ext}`).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const uniqueName = `${Date.now()}-${index + 1}-${rawName}`;
  const uploadDir = path.join(rootDir, 'public', 'images', 'uploads', slug);
  fs.mkdirSync(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return `/images/uploads/${slug}/${uniqueName}`;
}

/**
 * Vite dev plugin providing `POST /api/darkroom/save` so Darkroom edits
 * persist directly to JSON/Markdown files and `public/images/uploads/`.
 */
export function darkroomSavePlugin() {
  return {
    name: 'darkroom-save-api',
    configureServer(server) {
      const rootDir = server.config.root || process.cwd();

      server.middlewares.use('/api/darkroom/save', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        const chunks = [];
        let totalSize = 0;
        const maxBodySize = 30 * 1024 * 1024; // 30 MB

        req.on('data', (chunk) => {
          totalSize += chunk.length;
          if (totalSize > maxBodySize) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            const payload = JSON.parse(raw);
            const slug = String(payload.slug || '').trim();
            const frames = Array.isArray(payload.frames) ? payload.frames : [];

            if (!/^[a-z0-9-]+$/i.test(slug)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'Invalid section slug' }));
              return;
            }

            // Persist any newly uploaded images to public/images/uploads/<slug>/
            const savedFrames = frames.map((frame, index) => {
              const savedSrc = frame.dataUrl
                ? persistDataUrl(rootDir, slug, frame, index)
                : normalizeSrc(frame.src);

              return {
                ...frame,
                src: savedSrc,
                dataUrl: undefined,
              };
            });

            let savedCover = null;
            if (payload.cover && typeof payload.cover === 'object') {
              const coverSrc = payload.cover.dataUrl
                ? persistDataUrl(rootDir, slug, { ...payload.cover, fileName: payload.cover.fileName || 'cover.webp' }, 999)
                : normalizeSrc(payload.cover.src);
              savedCover = {
                src: coverSrc,
                focusX: typeof payload.cover.focusX === 'number' ? Math.round(payload.cover.focusX) : 50,
                focusY: typeof payload.cover.focusY === 'number' ? Math.round(payload.cover.focusY) : 50,
                zoom: typeof payload.cover.zoom === 'number' ? Number(payload.cover.zoom.toFixed(2)) : 1,
              };
            }

            // Helper to update src/data/pageCopy.json cleanly
            function updatePageCopy(sectionKey, copyData) {
              if (!copyData || typeof copyData !== 'object') return;
              const copyPath = path.join(rootDir, 'src', 'data', 'pageCopy.json');
              const existing = fs.existsSync(copyPath)
                ? JSON.parse(fs.readFileSync(copyPath, 'utf8'))
                : {};
              existing[sectionKey] = { ...(existing[sectionKey] || {}), ...copyData };
              fs.writeFileSync(copyPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
            }

            if (slug === 'home-hero') {
              const targetPath = path.join(rootDir, 'src', 'data', 'homeHero.json');
              const heroJson = savedFrames.map((f, idx) => ({
                src: f.src,
                title: f.alt || `Slide ${idx + 1}`,
                meta: f.meta || '',
                alt: f.alt || `Hero Slide ${idx + 1}`,
                aspect: f.aspect === 'portrait' ? 'portrait' : 'landscape',
                focusX: typeof f.focusX === 'number' ? Math.round(f.focusX) : 65,
                focusY: typeof f.focusY === 'number' ? Math.round(f.focusY) : 50,
                zoom: typeof f.zoom === 'number' ? Number(f.zoom.toFixed(2)) : 1,
              }));
              fs.writeFileSync(targetPath, JSON.stringify(heroJson, null, 2) + '\n', 'utf8');
              if (payload.copy) updatePageCopy('homeHero', payload.copy);
            } else if (slug === 'home-gallery') {
              const targetPath = path.join(rootDir, 'src', 'data', 'homeGallery.json');
              const galleryJson = savedFrames.map((f, idx) => ({
                title: f.alt || `Frame ${idx + 1}`,
                location: f.location || 'Trackside',
                meta: f.meta || '',
                src: f.src,
                category: f.category || 'Motorsport',
                alt: f.alt || `Gallery Frame ${idx + 1}`,
                aspect: f.aspect === 'portrait' ? 'portrait' : 'landscape',
              }));
              fs.writeFileSync(targetPath, JSON.stringify(galleryJson, null, 2) + '\n', 'utf8');
            } else if (slug === 'home-agency') {
              if (payload.copy) updatePageCopy('homeAgency', payload.copy);
            } else if (slug === 'portfolio-page') {
              if (payload.copy) updatePageCopy('portfolioHeader', payload.copy);
            } else if (slug === 'about-photo') {
              const targetPath = path.join(rootDir, 'src', 'data', 'aboutProfile.json');
              const firstFrame = savedFrames[0] || {};
              const aboutJson = {
                src: firstFrame.src || '/images/photos/motorsport-05.svg',
                alt: firstFrame.alt || 'Shu Zelin — Trackside Portrait',
                aspect: 'portrait',
                focusX: typeof firstFrame.focusX === 'number' ? Math.round(firstFrame.focusX) : 50,
                focusY: typeof firstFrame.focusY === 'number' ? Math.round(firstFrame.focusY) : 50,
                zoom: typeof firstFrame.zoom === 'number' ? Number(firstFrame.zoom.toFixed(2)) : 1,
              };
              fs.writeFileSync(targetPath, JSON.stringify(aboutJson, null, 2) + '\n', 'utf8');

              if (payload.copy) updatePageCopy('aboutIntro', payload.copy);

              if (payload.aboutMap && typeof payload.aboutMap === 'object') {
                const mapPath = path.join(rootDir, 'src', 'data', 'aboutSeriesMap.json');
                const cleanSeries = Array.isArray(payload.aboutMap.series)
                  ? payload.aboutMap.series.map((s, idx) => ({
                      id: String(s.id || `series-${idx + 1}`).trim(),
                      title: String(s.title || `Series ${idx + 1}`),
                      subtitle: String(s.subtitle || ''),
                    }))
                  : [];
                const cleanTracks = Array.isArray(payload.aboutMap.tracks)
                  ? payload.aboutMap.tracks.map((t, idx) => ({
                      id: String(t.id || `track-${idx + 1}`).trim(),
                      name: String(t.name || `Track ${idx + 1}`),
                      lat: Number(t.lat) || 0,
                      lon: Number(t.lon) || 0,
                      dx: Number(t.dx) || 0,
                      dy: Number(t.dy) || 0,
                      seriesIds: Array.isArray(t.seriesIds) ? t.seriesIds.map(String) : [],
                    }))
                  : [];
                fs.writeFileSync(
                  mapPath,
                  JSON.stringify({ series: cleanSeries, tracks: cleanTracks }, null, 2) + '\n',
                  'utf8'
                );
              }

              if (Array.isArray(payload.experiences)) {
                const expDir = path.join(rootDir, 'src', 'content', 'experiences');
                fs.mkdirSync(expDir, { recursive: true });
                const validTypes = new Set([
                  'Photography & Creative',
                  'Professional Experience',
                  'Exhibition & Recognition',
                ]);
                const keptFiles = new Set();

                payload.experiences.forEach((exp, idx) => {
                  const rawSlug = String(exp.slug || `experience-${idx + 1}`)
                    .replace(/[^a-z0-9-]+/gi, '-')
                    .toLowerCase();
                  const fileName = `${rawSlug}.md`;
                  keptFiles.add(fileName);
                  const expType = validTypes.has(exp.type) ? exp.type : 'Photography & Creative';
                  const highlights = Array.isArray(exp.highlights)
                    ? exp.highlights.filter((h) => String(h).trim().length > 0)
                    : [];
                  const highlightsYaml =
                    highlights.length === 0
                      ? 'highlights: []'
                      : 'highlights:\n' + highlights.map((h) => `  - ${yamlStr(h)}`).join('\n');

                  const expMd =
                    `---\n` +
                    `role: ${yamlStr(exp.role || 'Role')}\n` +
                    `organization: ${yamlStr(exp.organization || 'Organization')}\n` +
                    `type: ${yamlStr(expType)}\n` +
                    `period: ${yamlStr(exp.period || '')}\n` +
                    `location: ${yamlStr(exp.location || '')}\n` +
                    `order: ${idx + 1}\n` +
                    `current: ${Boolean(exp.current)}\n` +
                    `summary: ${yamlStr(exp.summary || '')}\n` +
                    `${highlightsYaml}\n` +
                    `tags: []\n` +
                    `---\n`;
                  fs.writeFileSync(path.join(expDir, fileName), expMd, 'utf8');
                });

                // Remove deleted experience files
                fs.readdirSync(expDir).forEach((f) => {
                  if (f.endsWith('.md') && !keptFiles.has(f)) {
                    fs.unlinkSync(path.join(expDir, f));
                  }
                });
              }
            } else {
              const mdPath = path.join(rootDir, 'src', 'content', 'photos', `${slug}.md`);
              if (!fs.existsSync(mdPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: `Series file not found: ${slug}.md` }));
                return;
              }

              const mdContent = fs.readFileSync(mdPath, 'utf8');
              const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/.exec(mdContent);
              if (!fmMatch) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'Invalid markdown frontmatter' }));
                return;
              }

              let frontmatter = fmMatch[1];
              const body = fmMatch[2];

              if (payload.seriesMeta && typeof payload.seriesMeta === 'object') {
                if (typeof payload.seriesMeta.title === 'string') {
                  frontmatter = frontmatter.replace(/^title:.*$/m, `title: ${yamlStr(payload.seriesMeta.title)}`);
                }
                if (typeof payload.seriesMeta.subtitle === 'string') {
                  frontmatter = frontmatter.replace(/^subtitle:.*$/m, `subtitle: ${yamlStr(payload.seriesMeta.subtitle)}`);
                }
              }

              if (savedCover) {
                frontmatter = frontmatter.replace(/^coverImage:.*$/m, `coverImage: ${yamlStr(savedCover.src)}`);
                frontmatter = frontmatter.replace(/\r?\ncoverFocusX:.*$/gm, '');
                frontmatter = frontmatter.replace(/\r?\ncoverFocusY:.*$/gm, '');
                frontmatter = frontmatter.replace(/\r?\ncoverZoom:.*$/gm, '');
                frontmatter = frontmatter.replace(
                  /^coverImage:.*$/m,
                  `coverImage: ${yamlStr(savedCover.src)}\ncoverFocusX: ${savedCover.focusX}\ncoverFocusY: ${savedCover.focusY}\ncoverZoom: ${savedCover.zoom}`
                );
              }

              // Remove existing gallery block (from `gallery:` to end of frontmatter or next top-level key)
              frontmatter = frontmatter.replace(/\r?\ngallery:\s*[\s\S]*?(?=\r?\n[a-zA-Z0-9_]+:|$)/, '');

              const galleryYaml =
                savedFrames.length === 0
                  ? 'gallery: []'
                  : 'gallery:\n' +
                    savedFrames
                      .map(
                        (f, idx) =>
                          `  - src: ${yamlStr(f.src)}\n` +
                          `    alt: ${yamlStr(f.alt || `Frame ${idx + 1}`)}\n` +
                          `    aspect: ${yamlStr(f.aspect === 'portrait' ? 'portrait' : 'landscape')}`
                      )
                      .join('\n');

              const updatedMd = `---\n${frontmatter.trimEnd()}\n${galleryYaml}\n---${body}`;
              fs.writeFileSync(mdPath, updatedMd, 'utf8');
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, slug, frames: savedFrames, cover: savedCover }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: err?.message || 'Save failed' }));
          }
        });
      });
    },
  };
}
