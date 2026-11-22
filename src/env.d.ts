/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_MEDIA_BASE_URL?: string;
  readonly PUBLIC_CLOUDFLARE_IMAGE_RESIZING?: string;
  readonly PUBLIC_CONTACT_ENDPOINT?: string;
  readonly PUBLIC_WEB3FORMS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
