# Darkroom Security & Live Azure Deployment Plan (Approach 1)

This document outlines the planned implementation for securing `/darkroom` and `/api/darkroom/*` when deploying the site to **Azure Static Web Apps (Free Tier)**—requiring **zero third-party tools**, **single-admin role restriction**, **Microsoft MFA**, and **persistent login sessions**.

> **Status:** Code implemented (ready for review & Azure Portal setup).
> - `staticwebapp.config.json` locked for `admin` role with `404` stealth overrides
> - `api/src/functions/darkroomSave.js` created for live Azure SWA GitHub commits
> - `/.auth/me` session badge & `Sign Out` link added to `/darkroom`

---

## Architecture Overview

- **Hosting:** Azure Static Web Apps (Free Tier, `$0/month`)
- **Authentication:** Azure SWA Built-In Auth with Microsoft Entra ID (`/.auth/login/aad`)
- **Authorization:** Edge-enforced `admin` role in `staticwebapp.config.json`
- **MFA:** Enforced via your Microsoft account (Microsoft Authenticator, Passkey / Touch ID, or Hardware Key)
- **Persistent Session:** Managed `StaticWebAppsAuthCookie` (`HttpOnly`, `Secure`) — stays logged in as long as browser cookies/cache are not cleared
- **Live Save Backend:** Azure Managed Function (`/api/darkroom/save`) replacing the local dev Vite plugin (`src/lib/darkroomPlugin.mjs`)

---

## Step-by-Step Implementation Checklist

### Step 1: Lock `/darkroom` and `/api/darkroom/*` in `staticwebapp.config.json`

Update `staticwebapp.config.json` at the project root so Azure's edge gateway blocks any visitor without the `admin` role before serving HTML, JS, or API responses:

1. **Restrict routes to `admin`:**
   - `/darkroom` and `/darkroom/*` → `allowedRoles: ["admin"]`
   - `/api/darkroom/*` → `allowedRoles: ["admin"]`
2. **Stealth `responseOverrides`:**
   - Return `404` (`/404.html`) on `401` / `403` for unauthenticated requests to `/darkroom*` (or redirect to `/.auth/login/aad?post_login_redirect_uri=/darkroom` on a private login trigger) so anyone guessing `/darkroom` sees a standard `404 Not Found`.
3. **Disable unused auth providers (optional hardening):**
   - Route `/.auth/login/github` and `/.auth/login/twitter` to `404` so only Microsoft Entra ID (`/.auth/login/aad`) is active.

Example route rules to merge into `staticwebapp.config.json`:

```json
{
  "routes": [
    {
      "route": "/darkroom",
      "allowedRoles": ["admin"]
    },
    {
      "route": "/darkroom/*",
      "allowedRoles": ["admin"]
    },
    {
      "route": "/api/darkroom/*",
      "allowedRoles": ["admin"]
    },
    {
      "route": "/.auth/login/github",
      "statusCode": 404
    },
    {
      "route": "/.auth/login/twitter",
      "statusCode": 404
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 404,
      "rewrite": "/404.html"
    },
    "403": {
      "statusCode": 404,
      "rewrite": "/404.html"
    }
  }
}
```

> **Note:** When `401` returns `404`, bookmark `https://yourdomain.com/.auth/login/aad?post_login_redirect_uri=/darkroom` as your private admin sign-in URL.

---

### Step 2: Create the Azure Managed Function (`/api/darkroom/save`)

Because deployed Static Web Apps do not have a writable local filesystem, move the save logic from `src/lib/darkroomPlugin.mjs` into an Azure Function inside `api/`:

1. Create `api/darkroom-save/index.js` (or Azure Functions v4 `api/src/functions/darkroomSave.js`) mapped to route `/api/darkroom/save`.
2. **Verify `x-ms-client-principal` header:**
   - Decode the base64 `x-ms-client-principal` header injected by Azure SWA and confirm `userRoles.includes('admin')` as defense-in-depth.
3. **Persist changes:**
   - **Images:** Upload optimized `.webp` files either to your **Azure Storage Account (Blob Container)** (using `AZURE_STORAGE_CONNECTION_STRING` in App Settings, paired with `PUBLIC_AZURE_STORAGE_URL` in `src/lib/media.ts`) or commit them directly to GitHub.
   - **Metadata (`homeHero.json`, `homeGallery.json`, `src/content/photos/*.md`):** Commit updated JSON/Markdown to your GitHub repository via the GitHub Contents/Git Data REST API using a fine-grained `GITHUB_TOKEN` stored in Azure App Settings.
4. Set `"api_location": "api"` in your Azure Static Web Apps GitHub Actions workflow.

---

### Step 3: Add Session Indicator & Sign-Out in `/darkroom`

In `src/pages/darkroom/index.astro`:
1. On load, optionally fetch `/.auth/me` (returns `{ clientPrincipal: { userDetails, userRoles } }` when hosted on Azure SWA; safely ignored on `localhost`).
2. Display the signed-in admin email and a `Sign Out` link (`/.auth/logout?post_logout_redirect_uri=/`) in the Darkroom header bar.

---

### Step 4: Azure Portal Configuration (One-Time Setup)

1. **Create Static Web App (Free Tier):**
   - Connect your GitHub repository (`App location: /`, `Api location: api`, `Output location: dist`).
2. **Invite Yourself as the Sole Admin:**
   - In Azure Portal → **Static Web App → Role management → Invite**:
     - **Authentication provider:** `Microsoft Entra ID` (Azure Active Directory)
     - **User email:** Your personal Microsoft account email
     - **Role:** `admin`
   - Accept the generated invitation link once while signed into your Microsoft account.
3. **Enable MFA on Your Microsoft Account:**
   - Ensure two-step verification (Microsoft Authenticator, Passkey, or Hardware Key) is active in your Microsoft Account Security settings.
   - Check **"Keep me signed in"** during login to retain your session cookie across visits without clearing cache.
4. **Configure Application Settings (Environment Variables in Azure Portal):**
   - `GITHUB_TOKEN` — Fine-grained PAT with `Contents: Read & Write` on your portfolio repo only
   - `GITHUB_REPO` — `owner/repo`
   - `AZURE_STORAGE_CONNECTION_STRING` *(if storing uploaded `.webp` files in Azure Blob Storage)*
   - `PUBLIC_AZURE_STORAGE_URL` *(if using Azure Blob Storage)*
