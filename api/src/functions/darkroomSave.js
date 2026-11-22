import { app } from '@azure/functions';

/**
 * Escapes a string for double-quoted YAML scalar values.
 */
function yamlStr(val) {
  return `"${String(val ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
}

function normalizeSrc(src) {
  if (!src) return '';
  return src.replace(/^https?:\/\/[^/]+/i, (m) => (m.includes('localhost') ? '' : m));
}

/**
 * Verifies Azure Static Web Apps injected `x-ms-client-principal` header
 * and confirms the caller holds the `admin` role.
 */
function verifyAdminPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);
    const roles = Array.isArray(principal.userRoles) ? principal.userRoles : [];
    if (!roles.includes('admin')) return null;
    return principal;
  } catch {
    return null;
  }
}

/**
 * GitHub REST API helper for reading and committing repository changes atomically.
 */
async function githubFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function readRepoFile(repo, branch, filePath, token) {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
  const data = await githubFetch(url, token);
  return Buffer.from(data.content, 'base64').toString('utf8');
}

/**
 * Commits multiple file updates/creations to GitHub in a single atomic commit.
 */
async function commitFilesToGitHub(repo, branch, token, message, filesToWrite) {
  const refData = await githubFetch(
    `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    token
  );
  const latestCommitSha = refData.object.sha;

  const commitData = await githubFetch(
    `https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`,
    token
  );
  const baseTreeSha = commitData.tree.sha;

  const treeEntries = [];
  for (const file of filesToWrite) {
    const blobData = await githubFetch(
      `https://api.github.com/repos/${repo}/git/blobs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          content: file.encoding === 'base64' ? file.content : Buffer.from(file.content, 'utf8').toString('base64'),
          encoding: 'base64',
        }),
      }
    );
    treeEntries.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  const newTree = await githubFetch(
    `https://api.github.com/repos/${repo}/git/trees`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    }
  );

  const newCommit = await githubFetch(
    `https://api.github.com/repos/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [latestCommitSha],
      }),
    }
  );

  await githubFetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    }
  );

  return newCommit.sha;
}

app.http('darkroomSave', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'darkroom/save',
  handler: async (request) => {
    const principal = verifyAdminPrincipal(request);
    if (!principal) {
      return { status: 403, jsonBody: { ok: false, error: 'Forbidden: admin role required' } };
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!token || !repo) {
      return {
        status: 500,
        jsonBody: { ok: false, error: 'Server missing GITHUB_TOKEN or GITHUB_REPO configuration' },
      };
    }

    try {
      const payload = await request.json();
      const slug = String(payload.slug || '').trim();
      const frames = Array.isArray(payload.frames) ? payload.frames : [];

      if (!/^[a-z0-9-]+$/i.test(slug)) {
        return { status: 400, jsonBody: { ok: false, error: 'Invalid section slug' } };
      }

      const filesToCommit = [];

      const stageImage = (frame, index, fallbackName) => {
        const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(frame.dataUrl || '');
        if (!match) return normalizeSrc(frame.src);

        const mime = match[1].toLowerCase();
        const base64Data = match[2];
        const ext = mime.includes('svg') ? 'svg' : mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';
        const rawName = (frame.fileName || fallbackName || `frame-${index + 1}.${ext}`)
          .replace(/[^a-z0-9._-]+/gi, '-')
          .toLowerCase();
        const uniqueName = `${Date.now()}-${index + 1}-${rawName}`;
        const repoImagePath = `public/images/uploads/${slug}/${uniqueName}`;

        filesToCommit.push({
          path: repoImagePath,
          content: base64Data,
          encoding: 'base64',
        });

        return `/images/uploads/${slug}/${uniqueName}`;
      };

      const savedFrames = frames.map((frame, index) => ({
        ...frame,
        src: frame.dataUrl ? stageImage(frame, index) : normalizeSrc(frame.src),
        dataUrl: undefined,
      }));

      let savedCover = null;
      if (payload.cover && typeof payload.cover === 'object') {
        const coverSrc = payload.cover.dataUrl
          ? stageImage(payload.cover, 999, 'cover.webp')
          : normalizeSrc(payload.cover.src);
        savedCover = {
          src: coverSrc,
          focusX: typeof payload.cover.focusX === 'number' ? Math.round(payload.cover.focusX) : 50,
          focusY: typeof payload.cover.focusY === 'number' ? Math.round(payload.cover.focusY) : 50,
          zoom: typeof payload.cover.zoom === 'number' ? Number(payload.cover.zoom.toFixed(2)) : 1,
        };
      }

      const stagePageCopyUpdate = async (sectionKey, copyData) => {
        if (!copyData || typeof copyData !== 'object') return;
        const raw = await readRepoFile(repo, branch, 'src/data/pageCopy.json', token);
        const existing = JSON.parse(raw);
        existing[sectionKey] = { ...(existing[sectionKey] || {}), ...copyData };
        filesToCommit.push({
          path: 'src/data/pageCopy.json',
          content: JSON.stringify(existing, null, 2) + '\n',
        });
      };

      if (slug === 'home-hero') {
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
        filesToCommit.push({
          path: 'src/data/homeHero.json',
          content: JSON.stringify(heroJson, null, 2) + '\n',
        });
        if (payload.copy) await stagePageCopyUpdate('homeHero', payload.copy);
      } else if (slug === 'home-gallery') {
        const galleryJson = savedFrames.map((f, idx) => ({
          title: f.alt || `Frame ${idx + 1}`,
          location: f.location || 'Trackside',
          meta: f.meta || '',
          src: f.src,
          category: f.category || 'Motorsport',
          alt: f.alt || `Gallery Frame ${idx + 1}`,
          aspect: f.aspect === 'portrait' ? 'portrait' : 'landscape',
        }));
        filesToCommit.push({
          path: 'src/data/homeGallery.json',
          content: JSON.stringify(galleryJson, null, 2) + '\n',
        });
      } else if (slug === 'home-agency') {
        if (payload.copy) await stagePageCopyUpdate('homeAgency', payload.copy);
      } else if (slug === 'portfolio-page') {
        if (payload.copy) await stagePageCopyUpdate('portfolioHeader', payload.copy);
      } else if (slug === 'about-photo') {
        const firstFrame = savedFrames[0] || {};
        const aboutJson = {
          src: firstFrame.src || '/images/photos/motorsport-05.svg',
          alt: firstFrame.alt || 'Shu Zelin — Trackside Portrait',
          aspect: 'portrait',
          focusX: typeof firstFrame.focusX === 'number' ? Math.round(firstFrame.focusX) : 50,
          focusY: typeof firstFrame.focusY === 'number' ? Math.round(firstFrame.focusY) : 50,
          zoom: typeof firstFrame.zoom === 'number' ? Number(firstFrame.zoom.toFixed(2)) : 1,
        };
        filesToCommit.push({
          path: 'src/data/aboutProfile.json',
          content: JSON.stringify(aboutJson, null, 2) + '\n',
        });

        if (payload.copy) await stagePageCopyUpdate('aboutIntro', payload.copy);

        if (payload.aboutMap && typeof payload.aboutMap === 'object') {
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
          filesToCommit.push({
            path: 'src/data/aboutSeriesMap.json',
            content: JSON.stringify({ series: cleanSeries, tracks: cleanTracks }, null, 2) + '\n',
          });
        }
      } else {
        const mdPath = `src/content/photos/${slug}.md`;
        const mdContent = await readRepoFile(repo, branch, mdPath, token);
        const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/.exec(mdContent);
        if (!fmMatch) {
          return { status: 500, jsonBody: { ok: false, error: 'Invalid markdown frontmatter' } };
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

        filesToCommit.push({
          path: mdPath,
          content: `---\n${frontmatter.trimEnd()}\n${galleryYaml}\n---${body}`,
        });
      }

      const commitSha = await commitFilesToGitHub(
        repo,
        branch,
        token,
        `darkroom: update ${slug} (${principal.userDetails || 'admin'})`,
        filesToCommit
      );

      return {
        status: 200,
        jsonBody: { ok: true, slug, commitSha, frames: savedFrames, cover: savedCover },
      };
    } catch (err) {
      return {
        status: 500,
        jsonBody: { ok: false, error: err?.message || 'Save failed' },
      };
    }
  },
});
