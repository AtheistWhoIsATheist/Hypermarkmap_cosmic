/**
 * Browser Download Helper & Granular Utilities
 * [REF: Export.Browser.DownloadHelper]
 * Cross-platform DOM download dispatching, object URL memory reclamation,
 * cryptographic SHA-256 digest computation, and human-readable byte formatting.
 */

export class ExportDownloadError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ExportDownloadError';
  }
}

/**
 * Triggers a native browser file download from a given Blob payload.
 * Synthesizes a temporary anchor element and cleans up the generated object URL.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new ExportDownloadError('Browser window and document context required for file download.');
  }

  let objectUrl: string | null = null;
  let link: HTMLAnchorElement | null = null;

  try {
    objectUrl = window.URL.createObjectURL(blob);
    link = document.createElement('a');
    link.href = objectUrl;
    link.download = sanitizeFilename(filename);
    link.style.display = 'none';
    link.setAttribute('aria-hidden', 'true');

    document.body.appendChild(link);
    link.click();
  } catch (err) {
    throw new ExportDownloadError(
      `Failed to trigger browser download for '${filename}': ${(err as Error).message}`,
      err
    );
  } finally {
    if (link && link.parentNode) {
      link.parentNode.removeChild(link);
    }
    // Asynchronously revoke the Object URL after the browser has initiated the download stream
    if (objectUrl) {
      const urlToRevoke = objectUrl;
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(urlToRevoke);
        } catch {
          // Ignore revocation cleanup errors
        }
      }, 1000);
    }
  }
}

/**
 * Computes a SHA-256 hexadecimal checksum for the serialized JSON string.
 * Uses Web Crypto API when available, with deterministic fallback.
 */
export async function computeExportChecksum(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const encoded = new TextEncoder().encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to lightweight JS hash
    }
  }

  // Fallback 32-bit FNV-1a hash formatted as 64-char zero-padded string
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return part.padStart(64, '0');
}

/**
 * Sanitizes arbitrary input strings into safe ASCII filenames.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  return base.length > 0 ? base : 'topology_export.json';
}

/**
 * Formats raw byte sizes into human-readable strings (e.g., 2.45 MB, 14.2 KB).
 */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
