/**
 * External URL sanitization helper.
 * Permits strictly http: and https: URLs and rejects javascript:, data:, vbscript:, or malformed URIs.
 */
export function sanitizeExternalUrl(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}
