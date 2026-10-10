import type {
  Source,
  Passage,
  Concept,
  Claim,
  MandatoryCorrection,
  AdversarialObjection,
  Contradiction,
  ManuscriptSection,
  ResearchJob,
  AuditReport,
  FullExportBundle,
  HypermapNode,
  HypermapTreeNode,
  HypermapNodeInput,
  HypermapStats,
  HypermapDensifyResult
} from './types';

export interface StatsResponse {
  sources: number;
  passages: number;
  concepts: number;
  claims: number;
  corrections: number;
  objections: number;
  contradictions: number;
  researchJobs: number;
  manuscriptChapters: number;
  totalManuscriptWords: number;
}

export interface PassageContextResponse {
  passage: Passage;
  prevPassage: Passage | null;
  nextPassage: Passage | null;
  source: Source | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.error) errMsg = data.error;
      } else {
        const text = await res.text();
        if (text && !text.trim().startsWith('<') && text.length < 200) {
          errMsg = text;
        }
      }
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.trim().startsWith('<')) {
      throw new Error(`Server returned HTML instead of JSON for API request: ${res.url}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse response as JSON: ${text.slice(0, 100)}`);
    }
  }

  return res.json() as Promise<T>;
}

function request(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(65000) });
}
export const api = {
  getHealth: async (): Promise<{ ai: { configured: boolean; model: string; provider: string } }> => {
    return handleResponse(await request('/api/health'));
  },
  getStats: async (): Promise<StatsResponse> => {
    const res = await request('/api/stats');
    return handleResponse<StatsResponse>(res);
  },

  getSources: async (): Promise<Source[]> => {
    const res = await request('/api/sources');
    return handleResponse<Source[]>(res);
  },

  ingestText: async (filename: string, text: string): Promise<Source> => {
    const res = await request('/api/sources/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentText: text })
    });
    const result = await handleResponse<{ source: Source; passageCount: number }>(res);
    return result.source;
  },

  searchPassages: async (query: string, limit: number = 25): Promise<Passage[]> => {
    const res = await request(`/api/passages/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return handleResponse<Passage[]>(res);
  },

  getPassageContext: async (id: string): Promise<PassageContextResponse> => {
    const res = await request(`/api/passages/${encodeURIComponent(id)}`);
    const result = await handleResponse<{ target: Passage; before: Passage[]; after: Passage[]; source: Source | null }>(res);
    return { passage: result.target, prevPassage: result.before.at(-1) || null, nextPassage: result.after[0] || null, source: result.source };
  },

  getCorrections: async (): Promise<MandatoryCorrection[]> => {
    const res = await request('/api/corrections');
    return handleResponse<MandatoryCorrection[]>(res);
  },

  getClaims: async (): Promise<Claim[]> => {
    const res = await request('/api/claims');
    return handleResponse<Claim[]>(res);
  },

  createClaim: async (claim: Partial<Claim>): Promise<Claim> => {
    const res = await request('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claim)
    });
    return handleResponse<Claim>(res);
  },

  getObjections: async (): Promise<AdversarialObjection[]> => {
    const res = await request('/api/objections');
    return handleResponse<AdversarialObjection[]>(res);
  },

  createObjection: async (objection: Partial<AdversarialObjection>): Promise<AdversarialObjection> => {
    const res = await request('/api/objections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(objection)
    });
    return handleResponse<AdversarialObjection>(res);
  },

  getContradictions: async (): Promise<Contradiction[]> => {
    const res = await request('/api/contradictions');
    return handleResponse<Contradiction[]>(res);
  },

  getManuscriptChapters: async (): Promise<ManuscriptSection[]> => {
    const res = await request('/api/manuscript');
    return handleResponse<ManuscriptSection[]>(res);
  },

  getManuscriptChapter: async (num: number): Promise<ManuscriptSection> => {
    const res = await request(`/api/manuscript/${num}`);
    return handleResponse<ManuscriptSection>(res);
  },

  getJobs: async (): Promise<ResearchJob[]> => {
    const res = await request('/api/jobs');
    return handleResponse<ResearchJob[]>(res);
  },

  runResearchLoopStep: async (focusArea?: string, maxClaims?: number): Promise<{ job: ResearchJob; newClaimsCount: number; newObjectionsCount: number }> => {
    const res = await request('/api/jobs/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focus_area: focusArea, max_claims: maxClaims })
    });
    return handleResponse<{ job: ResearchJob; newClaimsCount: number; newObjectionsCount: number }>(res);
  },

  runAudit: async (): Promise<AuditReport> => {
    const res = await request('/api/audit');
    return handleResponse<AuditReport>(res);
  },

  getHypermapTree: async (root?: string): Promise<HypermapTreeNode> => {
    const query = root ? `?root=${encodeURIComponent(root)}` : '';
    const res = await request(`/api/hypermap/tree${query}`);
    return handleResponse<HypermapTreeNode>(res);
  },

  getHypermapStats: async (): Promise<HypermapStats> => {
    const res = await request('/api/hypermap/stats');
    return handleResponse<HypermapStats>(res);
  },

  getHypermapNode: async (id: string): Promise<HypermapNode> => {
    const res = await request(`/api/hypermap/node/${encodeURIComponent(id)}`);
    return handleResponse<HypermapNode>(res);
  },

  addHypermapNode: async (input: HypermapNodeInput): Promise<HypermapNode> => {
    const res = await request('/api/hypermap/node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return handleResponse<HypermapNode>(res);
  },

  updateHypermapNode: async (id: string, updates: Partial<HypermapNodeInput>): Promise<HypermapNode> => {
    const res = await request(`/api/hypermap/node/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return handleResponse<HypermapNode>(res);
  },

  deleteHypermapNode: async (id: string): Promise<{ success: boolean; deletedCount: number }> => {
    const res = await request(`/api/hypermap/node/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; deletedCount: number }>(res);
  },

  densifyHypermapNode: async (nodeId: string, strategy?: string): Promise<HypermapDensifyResult> => {
    const res = await request('/api/hypermap/densify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, strategy })
    });
    return handleResponse<HypermapDensifyResult>(res);
  },

  getExportBundleUrl: (): string => '/api/export/bundle',
  getExportZipUrl: (): string => '/api/export/zip'
};
