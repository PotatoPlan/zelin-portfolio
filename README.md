# Visual Portfolio & Creative Archive (Astro + Tailwind CSS)

A fast, static-first photography & experience portfolio designed for **Azure Static Web Apps** (Free Tier) and future-proofed for **Cloudflare R2 / CDN** media hosting.

## Key Features

- **Pages Included:**
  - `/` — Editorial home page with hero, stats, featured photo series, bio & kit overview, experience snapshot, and downloadable PDF lookbook banner.
  - `/gallery` — Filterable photography archive with **Series Stories view** and **All Frames masonry view** + interactive keyboard-accessible **Lightbox** (`ESC` to close).
  - `/gallery/[slug]` — Individual photo series deep-dive page with Markdown field notes, camera/lens/EXIF metadata bar, and full frame sequence.
  - `/experience` — Career, creative projects & exhibitions timeline + field kit / technical skills matrix.
  - `/contact` — Social channels directory + interactive contact form (supports Web3Forms, Formspree/Azure Functions endpoint, or zero-config `mailto:` fallback).
- **Cloudflare-Ready Media Layer (`src/lib/media.ts`):**
  - **Now (Simple Local Mode):** Place low-res or web-sized images in `public/images/photos/` and your PDF lookbook in `public/files/portfolio-lookbook.pdf`. Leave `PUBLIC_MEDIA_BASE_URL` blank.
  - **Later (Cloudflare R2 / CDN Mode):** Upload high-res photos & PDFs to a Cloudflare R2 bucket and set `PUBLIC_MEDIA_BASE_URL=https://media.yourdomain.com` in `.env` — all existing photo series and PDF links resolve to Cloudflare automatically without changing your Markdown files.

## Quick Start

```bash
npm install
npm run dev
```

## Where to Customize Your Content

1. **Profile, Bio, Socials & Downloadable PDF Config:**
   Edit `src/data/site.ts`.
2. **Add or Edit Photo Series & Descriptions:**
   Add Markdown files in `src/content/photos/*.md`.
3. **Add or Edit Experience Entries:**
   Add Markdown files in `src/content/experiences/*.md`.
4. **Replace Sample Portfolio PDF:**
   Replace `public/files/portfolio-lookbook.pdf` with your actual exported PDF.

## Deploying to Azure Static Web Apps (Free Tier)

- **App location:** `/`
- **Api location:** *(leave empty unless adding Azure Functions)*
- **Output location:** `dist`
- Includes `staticwebapp.config.json` preconfigured with immutable asset caching and SPA/404 fallback rules.
- **Future Darkroom Auth & MFA Plan:** See [docs/darkroom-azure-security.md](docs/darkroom-azure-security.md) for the planned Azure SWA + Microsoft Entra ID `admin` role + MFA implementation steps.
