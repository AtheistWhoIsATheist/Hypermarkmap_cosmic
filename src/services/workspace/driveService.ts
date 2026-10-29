import { getAccessToken } from './authService';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  iconLink?: string;
  webViewLink?: string;
  parents?: string[];
  description?: string;
}

export interface ListFilesOptions {
  query?: string;
  mimeTypeFilter?: 'all' | 'docs' | 'text' | 'pdf' | 'csv' | 'json';
  pageSize?: number;
  pageToken?: string;
}

export interface ListFilesResult {
  files: DriveFile[];
  nextPageToken?: string;
}

export const GOOGLE_DOCS_MIME = 'application/vnd.google-apps.document';

/**
 * List files from the user's Google Drive.
 */
export async function listDriveFiles(options: ListFilesOptions = {}): Promise<ListFilesResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Drive.');
  }

  const queryParts: string[] = ['trashed = false'];

  if (options.mimeTypeFilter === 'docs') {
    queryParts.push(`mimeType = '${GOOGLE_DOCS_MIME}'`);
  } else if (options.mimeTypeFilter === 'text') {
    queryParts.push(
      `(mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'text/x-markdown' or name contains '.md' or name contains '.txt')`
    );
  } else if (options.mimeTypeFilter === 'pdf') {
    queryParts.push(`mimeType = 'application/pdf'`);
  } else if (options.mimeTypeFilter === 'csv') {
    queryParts.push(`(mimeType = 'text/csv' or name contains '.csv')`);
  } else if (options.mimeTypeFilter === 'json') {
    queryParts.push(`(mimeType = 'application/json' or name contains '.json')`);
  }

  if (options.query && options.query.trim()) {
    const sanitized = options.query.replace(/'/g, "\\'");
    queryParts.push(`name contains '${sanitized}'`);
  }

  const q = queryParts.join(' and ');
  const pageSize = options.pageSize || 25;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set(
    'fields',
    'nextPageToken, files(id, name, mimeType, modifiedTime, size, iconLink, webViewLink, parents, description)'
  );
  url.searchParams.set('orderBy', 'modifiedTime desc');
  if (options.pageToken) {
    url.searchParams.set('pageToken', options.pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken
  };
}

/**
 * Get single file metadata by ID.
 */
export async function getDriveFile(fileId: string): Promise<DriveFile> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Drive.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,iconLink,webViewLink,parents,description`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Downloads the content of a file from Drive.
 * For Google Docs, exports as plain text/markdown.
 * For raw files (txt, md, json, csv, pdf), downloads the file blob.
 */
export async function downloadDriveFileContent(file: DriveFile): Promise<{ content: string; blob?: Blob }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Drive.');
  }

  if (file.mimeType === GOOGLE_DOCS_MIME) {
    // Export Google Doc as text/plain
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
    const res = await fetch(exportUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to export Google Doc (${res.status}): ${err}`);
    }

    const text = await res.text();
    return { content: text };
  }

  // Non-Google Doc files
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to download file from Drive (${res.status}): ${err}`);
  }

  if (file.mimeType.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
    const text = await res.text();
    return { content: text };
  }

  const blob = await res.blob();
  return { content: '', blob };
}

/**
 * Delete a file permanently from Google Drive.
 * Precondition: MUST only be called after user has confirmed in UI.
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Drive.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Failed to delete file from Google Drive (${res.status}): ${err}`);
  }
}

/**
 * Move a file to Google Drive trash.
 * Precondition: MUST only be called after user has confirmed in UI.
 */
export async function trashDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Drive.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ trashed: true })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to move file to trash (${res.status}): ${err}`);
  }
}
