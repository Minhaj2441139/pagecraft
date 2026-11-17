const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i;

/**
 * Allow only http(s), mailto, tel, fragment and relative URLs (plus base64
 * raster images for `img`). Anything else, notably `javascript:`, becomes "#".
 */
export function safeUrl(value: string, { allowDataImage = false } = {}): string {
  const trimmed = value.trim();
  if (trimmed === "") return "#";
  if (SAFE_URL.test(trimmed)) return trimmed;
  if (allowDataImage && SAFE_DATA_IMAGE.test(trimmed)) return trimmed;
  // Bare relative paths like "pricing.html" contain no scheme.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return "#";
}

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

export function safeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return SAFE_COLOR.test(trimmed) ? trimmed : undefined;
}
