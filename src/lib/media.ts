/**
 * Storage-Agnostic & Azure Blob Media Resolver
 *
 * Works with local files in `/public/images/...` or `/public/files/...` today,
 * and seamlessly switches to Azure Blob Storage / Azure CDN when
 * `PUBLIC_AZURE_STORAGE_URL` or `PUBLIC_MEDIA_BASE_URL` is configured in `.env`.
 */

export interface MediaTransformOptions {
  width?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop';
}

const rawBaseUrl =
  import.meta.env.PUBLIC_AZURE_STORAGE_URL?.trim() ||
  import.meta.env.PUBLIC_MEDIA_BASE_URL?.trim() ||
  '';
const mediaBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const azureSasToken =
  import.meta.env.PUBLIC_AZURE_SAS_TOKEN?.trim().replace(/^\?/, '') || '';

/**
 * Resolves a logical asset path (e.g. "photos/formula-1/frame-01.webp")
 * to either a local `/public` URL or your Azure Blob Storage / CDN container URL.
 */
export function resolveMediaUrl(
  src: string,
  _options?: MediaTransformOptions
): string {
  if (!src) return '';

  // Already an external URL, blob URL, or data URI
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) {
    return appendSasIfNeeded(src);
  }

  // Normalize leading slash
  const cleanPath = src.replace(/^\/+/, '');

  // If no external Azure / CDN URL is configured, serve from local `/public`
  if (!mediaBaseUrl) {
    if (cleanPath.startsWith('images/') || cleanPath.startsWith('files/')) {
      return `/${cleanPath}`;
    }
    return `/images/${cleanPath}`;
  }

  // External Azure Blob Storage container or CDN base URL configured
  const fullRemoteUrl = `${mediaBaseUrl}/${cleanPath}`;
  return appendSasIfNeeded(fullRemoteUrl);
}

function appendSasIfNeeded(url: string): string {
  if (!azureSasToken || !url.includes('blob.core.windows.net')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${azureSasToken}`;
}

/**
 * Generates a `srcset` string when external responsive variants exist.
 * Returns `undefined` in standard mode so regular pre-optimized WebP `<img>` works cleanly.
 */
export function getResponsiveSrcSet(
  _src: string,
  _widths: number[] = [640, 1024, 1600],
  _quality = 82
): string | undefined {
  return undefined;
}
