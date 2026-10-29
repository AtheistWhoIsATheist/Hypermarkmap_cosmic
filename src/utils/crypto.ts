/**
 * Cryptographic & Content Hashing Utilities
 * Uses native Web Cryptography API (crypto.subtle) for deterministic SHA-256 hashing,
 * scoped ID generation, and non-destructive presentation sanitization.
 */

import type { SupportedMimeType } from '../types/graph';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB threshold

/**
 * Computes deterministic SHA-256 fingerprint for a File, Blob, ArrayBuffer, or string.
 * Returns a 64-character lowercase hexadecimal digest.
 */
export async function computeFileSha256(
  input: File | Blob | ArrayBuffer | string
): Promise<string> {
  let buffer: ArrayBuffer;

  if (typeof input === 'string') {
    const encoder = new TextEncoder();
    buffer = encoder.encode(input).buffer;
  } else if (input instanceof ArrayBuffer) {
    buffer = input;
  } else {
    buffer = await input.arrayBuffer();
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a fast deterministic 32-bit FNV-1a hash for strings, used for localized seed mixing.
 */
export function fnv1a32(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates scoped deterministic IDs encoding scope, file hash prefix, and context seed.
 * Ensures distinct concepts with similar names (e.g., Nothingness vs. Divine Nothingness)
 * never collide globally.
 */
export function generateScopedId(
  scope: 'doc' | 'ver' | 'sec' | 'span' | 'concept' | 'prop' | 'edge' | 'cit',
  fileHash: string,
  seed: string | number
): string {
  const hashPrefix = fileHash.substring(0, 8);
  const seedStr = String(seed);
  const seedHash = fnv1a32(seedStr);
  // Clean alphanumeric slug for readability if seed contains text
  const slug = typeof seed === 'string'
    ? seed.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 48).replace(/^_+|_+$/g, '')
    : '';

  if (slug) {
    return `${scope}_${hashPrefix}_${slug}_${seedHash}`;
  }
  return `${scope}_${hashPrefix}_${seedHash}`;
}

/**
 * Non-destructive text sanitization for presentation boundary.
 * Strips executable script tags, dangerous control characters, and zero-width spaces
 * while preserving verbatim text intact.
 */
export function sanitizeDisplayText(text: string): string {
  if (!text) return '';
  return text
    // Remove zero-width spaces, null bytes, and non-printable control chars (except \n, \r, \t)
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    // Replace script tags and raw dangerous tags for UI presentation
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT REMOVED]')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '[IFRAME REMOVED]')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '[OBJECT REMOVED]');
}

/**
 * Validates file size, extension, MIME type, and leading magic bytes.
 */
export async function validateFileHeaderAndMime(
  file: File
): Promise<{ detectedMime: SupportedMimeType; isValid: boolean; error?: string }> {
  // 1. Size guardrail check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      detectedMime: 'text/plain',
      isValid: false,
      error: `File size exceeds the 25 MiB client-side threshold (size: ${(file.size / (1024 * 1024)).toFixed(2)} MiB).`
    };
  }

  const name = file.name.toLowerCase();
  const declaredType = file.type.toLowerCase();

  // 2. Extension determination
  if (name.endsWith('.pdf')) {
    // Check magic bytes for PDF: %PDF-
    const slice = await file.slice(0, 8).arrayBuffer();
    const header = new TextDecoder('ascii').decode(slice);
    if (!header.startsWith('%PDF-')) {
      return {
        detectedMime: 'application/pdf',
        isValid: false,
        error: `File has .pdf extension but lacks the '%PDF-' magic header.`
      };
    }
    return { detectedMime: 'application/pdf', isValid: true };
  }

  if (name.endsWith('.json')) {
    return { detectedMime: 'application/json', isValid: true };
  }

  if (name.endsWith('.csv')) {
    return { detectedMime: 'text/csv', isValid: true };
  }

  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return { detectedMime: 'text/markdown', isValid: true };
  }

  if (name.endsWith('.txt')) {
    return { detectedMime: 'text/plain', isValid: true };
  }

  // 3. Fallback to declared MIME type
  if (declaredType === 'application/pdf') return { detectedMime: 'application/pdf', isValid: true };
  if (declaredType === 'application/json') return { detectedMime: 'application/json', isValid: true };
  if (declaredType === 'text/csv' || declaredType === 'application/csv') return { detectedMime: 'text/csv', isValid: true };
  if (declaredType === 'text/markdown') return { detectedMime: 'text/markdown', isValid: true };
  if (declaredType.startsWith('text/')) return { detectedMime: 'text/plain', isValid: true };

  return {
    detectedMime: 'text/plain',
    isValid: false,
    error: `Unsupported format: '${file.name}'. Supported formats: .md, .markdown, .txt, .pdf, .json, .csv.`
  };
}
