import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  FolderOpen,
  Search,
  RefreshCw,
  ExternalLink,
  Trash2,
  Download,
  Upload,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  File,
  HardDrive,
  LogOut,
  Sparkles,
  Share2
} from 'lucide-react';
import {
  googleSignIn,
  logout,
  getCurrentUser,
  subscribeAuthState,
  getAccessToken
} from '../services/workspace/authService';
import {
  listDriveFiles,
  downloadDriveFileContent,
  trashDriveFile,
  deleteDriveFile,
  GOOGLE_DOCS_MIME,
  type DriveFile
} from '../services/workspace/driveService';
import {
  getGoogleDoc,
  parseGoogleDocToMarkdown,
  createGoogleDoc,
  exportKnowledgeGraphToGoogleDoc
} from '../services/workspace/docsService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ConfirmModal } from './ConfirmModal';
import { processIngestionBatch } from '../services/ingestion/IngestionService';
import { GraphStorage } from '../storage/GraphStorage';
import type { EpistemicTopologyNode } from './GroundedEpistemicTopologyData';
import type { GraphNode, GraphEdge, IngestionBatchItem } from '../types/graph';
import type { User } from 'firebase/auth';

interface GoogleWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestionComplete?: (results?: IngestionBatchItem[]) => void;
  selectedNode?: EpistemicTopologyNode | null;
  baselineTree?: EpistemicTopologyNode;
  ingestedGraph?: { nodes: GraphNode[]; edges: GraphEdge[] };
}

type TabType = 'drive' | 'export' | 'create';

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onIngestionComplete,
  selectedNode,
  baselineTree,
  ingestedGraph
}) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('drive');

  // Drive Browser State
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'docs' | 'text' | 'pdf' | 'csv' | 'json'>('docs');
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [fileActionSuccess, setFileActionSuccess] = useState<string | null>(null);

  // Ingesting from Drive State
  const [ingestingFileId, setIngestingFileId] = useState<string | null>(null);

  // Destructive Confirmation State (MANDATORY per skill)
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export to Docs State
  const [exportTitle, setExportTitle] = useState(
    `Nihiltheism Epistemic Dossier — ${new Date().toISOString().slice(0, 10)}`
  );
  const [exportScope, setExportScope] = useState<'all' | 'selected' | 'ingested'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedDocLink, setExportedDocLink] = useState<{ id: string; url: string; title: string } | null>(null);

  // Create New Doc State
  const [newDocTitle, setNewDocTitle] = useState('New Philosophical Inquiry');
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [createdDocLink, setCreatedDocLink] = useState<{ id: string; url: string; title: string } | null>(null);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeAuthState((u, token) => {
      setUser(u);
      setHasToken(Boolean(token));
    });
    return unsubscribe;
  }, []);

  // Fetch Drive Files when user is authenticated
  const fetchFiles = useCallback(async () => {
    if (!hasToken) return;
    setIsLoadingFiles(true);
    setFileActionError(null);
    try {
      const result = await listDriveFiles({
        query: searchQuery,
        mimeTypeFilter: filterType,
        pageSize: 30
      });
      setFiles(result.files);
    } catch (err: unknown) {
      console.error('[GoogleWorkspaceModal] Error loading Drive files:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load files from Google Drive';
      setFileActionError(msg);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [hasToken, searchQuery, filterType]);

  useEffect(() => {
    if (isOpen && hasToken && activeTab === 'drive') {
      fetchFiles();
    }
  }, [isOpen, hasToken, activeTab, fetchFiles]);

  const handleLogin = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasToken(true);
      }
    } catch (err: unknown) {
      console.error('[GoogleWorkspaceModal] Login error:', err);
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setHasToken(false);
      setFiles([]);
    } catch (err) {
      console.error('[GoogleWorkspaceModal] Logout error:', err);
    }
  };

  // Ingest Google Doc or Drive file directly into Knowledge Graph
  const handleIngestDriveFile = async (file: DriveFile) => {
    setIngestingFileId(file.id);
    setFileActionError(null);
    setFileActionSuccess(null);
    try {
      let fileToIngest: File;

      if (file.mimeType === GOOGLE_DOCS_MIME) {
        // Fetch structured Google Doc AST
        const doc = await getGoogleDoc(file.id);
        const markdown = parseGoogleDocToMarkdown(doc);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const fileName = (file.name.endsWith('.md') ? file.name : `${file.name}.md`).replace(/\s+/g, '_');
        fileToIngest = new (window as any).File([blob], fileName, { type: 'text/markdown' });
      } else {
        const { content, blob } = await downloadDriveFileContent(file);
        const finalBlob = blob || new Blob([content], { type: file.mimeType || 'text/plain' });
        fileToIngest = new (window as any).File([finalBlob], file.name.replace(/\s+/g, '_'), {
          type: file.mimeType || 'text/plain'
        });
      }

      // Process through ingestion pipeline
      await processIngestionBatch(
        [fileToIngest],
        undefined,
        { processingMode: 'STRUCTURALLY_INGESTED' }
      );

      setFileActionSuccess(`Successfully ingested "${file.name}" into Knowledge Graph with SourceSpan provenance.`);
      onIngestionComplete?.();
    } catch (err: unknown) {
      console.error('[GoogleWorkspaceModal] Ingestion error:', err);
      setFileActionError(err instanceof Error ? err.message : 'Failed to ingest file into Knowledge Graph');
    } finally {
      setIngestingFileId(null);
    }
  };

  // Perform Destructive Delete (after user confirmation)
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    setFileActionError(null);
    try {
      await trashDriveFile(fileToDelete.id);
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setFileActionSuccess(`Moved "${fileToDelete.name}" to Google Drive trash.`);
      setFileToDelete(null);
    } catch (err: unknown) {
      console.error('[GoogleWorkspaceModal] Delete error:', err);
      setFileActionError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Knowledge Graph to Google Doc
  const handleExportToGoogleDoc = async () => {
    setIsExporting(true);
    setFileActionError(null);
    setExportedDocLink(null);

    try {
      const allBaselineNodes: EpistemicTopologyNode[] = [];
      const collectNodes = (node?: EpistemicTopologyNode) => {
        if (!node) return;
        allBaselineNodes.push(node);
        node.children?.forEach(collectNodes);
      };
      if (baselineTree) collectNodes(baselineTree);

      const ingestedNodes = ingestedGraph?.nodes || [];
      const ingestedEdges = ingestedGraph?.edges || [];

      let targetNodes: Array<EpistemicTopologyNode | GraphNode> = [];

      if (exportScope === 'selected' && selectedNode) {
        targetNodes = [selectedNode];
      } else if (exportScope === 'ingested') {
        targetNodes = ingestedNodes.length > 0 ? ingestedNodes : allBaselineNodes.slice(0, 20);
      } else {
        targetNodes = [...allBaselineNodes, ...ingestedNodes];
      }

      const result = await exportKnowledgeGraphToGoogleDoc({
        title: exportTitle.trim() || 'Nihiltheism Knowledge Graph Dossier',
        nodes: targetNodes,
        edges: ingestedEdges
      });

      setExportedDocLink({
        id: result.documentId,
        url: result.webViewLink,
        title: result.title
      });
      setFileActionSuccess(`Google Doc created: "${result.title}"`);
    } catch (err: unknown) {
      console.error('[GoogleWorkspaceModal] Export error:', err);
      setFileActionError(err instanceof Error ? err.message : 'Failed to export to Google Docs');
    } finally {
      setIsExporting(false);
    }
  };

  // Create new Blank Google Doc
  const handleCreateNewDoc = async () => {
    setIsCreatingDoc(true);
    setFileActionError(null);
    setCreatedDocLink(null);
    try {
      const doc = await createGoogleDoc(newDocTitle.trim() || 'Philosophical Manuscript Draft');
      const webViewLink = `https://docs.google.com/document/d/${doc.documentId}/edit`;
      setCreatedDocLink({
        id: doc.documentId,
        url: webViewLink,
        title: doc.title || newDocTitle
      });
      setFileActionSuccess(`Created Google Doc: "${doc.title || newDocTitle}"`);
      if (hasToken) fetchFiles();
    } catch (err: unknown) {
      console.error('[GoogleWorkspaceModal] Create Doc error:', err);
      setFileActionError(err instanceof Error ? err.message : 'Failed to create Google Doc');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Google Workspace Hub: Drive and Docs"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[92vh] bg-slate-950/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <header className="px-6 py-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-cyan-600 to-indigo-600 p-[1px] flex items-center justify-center shadow-lg">
                <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center text-cyan-400">
                  <HardDrive className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <h2 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2">
                  <span>Google Workspace Integration</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-blue-400 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/50">
                    Drive & Docs
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Browse Google Drive, ingest Google Docs into the Knowledge Graph, and export philosophical research dossiers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-cyan-900 text-[10px] flex items-center justify-center font-bold text-cyan-200">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-slate-300 font-medium truncate max-w-[120px]">
                    {user.displayName || user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="text-slate-400 hover:text-rose-400 ml-1 p-0.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Navigation Tabs */}
          <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between gap-4 overflow-x-auto shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('drive')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                  activeTab === 'drive'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Google Drive Browser</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                  activeTab === 'export'
                    ? 'bg-blue-950 text-blue-300 border border-blue-600/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Export Graph to Google Docs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                  activeTab === 'create'
                    ? 'bg-purple-950 text-purple-300 border border-purple-600/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>Create New Google Doc</span>
              </button>
            </div>

            {hasToken && activeTab === 'drive' && (
              <button
                onClick={fetchFiles}
                disabled={isLoadingFiles}
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition disabled:opacity-50"
                title="Refresh Drive Files"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Banner Notifications */}
          {fileActionSuccess && (
            <div className="mx-6 mt-3 p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{fileActionSuccess}</span>
              </div>
              <button
                onClick={() => setFileActionSuccess(null)}
                className="text-emerald-400 hover:text-emerald-200 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {fileActionError && (
            <div className="mx-6 mt-3 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{fileActionError}</span>
              </div>
              <button
                onClick={() => setFileActionError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
            {!hasToken ? (
              /* Signed Out State / Google Sign-in Call to Action */
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                  <HardDrive className="w-8 h-8" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-100">Connect Google Drive & Google Docs</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    With permission from you, this application connects to your Google Drive to browse manuscripts,
                    read Google Docs into the Nihiltheism Knowledge Graph, and export epistemic research dossiers.
                  </p>
                </div>

                {authError && (
                  <p className="text-xs text-rose-400 bg-rose-950/50 px-3 py-1.5 rounded-lg border border-rose-900">
                    {authError}
                  </p>
                )}

                <div className="pt-2">
                  <GoogleSignInButton
                    onClick={handleLogin}
                    isLoading={isSigningIn}
                    label="Sign in with Google to Connect Workspace"
                  />
                </div>
              </div>
            ) : (
              /* Signed In State */
              <>
                {/* TAB 1: DRIVE BROWSER */}
                {activeTab === 'drive' && (
                  <div className="space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {/* Filter Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { id: 'docs', label: 'Google Docs', icon: FileText },
                          { id: 'text', label: 'Markdown & Text', icon: FileCode },
                          { id: 'pdf', label: 'PDFs', icon: File },
                          { id: 'csv', label: 'CSVs', icon: FileSpreadsheet },
                          { id: 'all', label: 'All Files', icon: FolderOpen }
                        ].map((chip) => {
                          const IconComp = chip.icon;
                          const active = filterType === chip.id;
                          return (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => setFilterType(chip.id as any)}
                              className={`px-2.5 py-1 rounded-md text-xs font-mono transition flex items-center gap-1.5 ${
                                active
                                  ? 'bg-cyan-900/70 text-cyan-200 border border-cyan-500/50 shadow-sm'
                                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                              }`}
                            >
                              <IconComp className="w-3 h-3" />
                              <span>{chip.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Search Bar */}
                      <div className="relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search Drive files..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                        />
                      </div>
                    </div>

                    {/* Files List */}
                    {isLoadingFiles ? (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                        <span className="text-xs font-mono">Querying Google Drive files...</span>
                      </div>
                    ) : files.length === 0 ? (
                      <div className="p-10 rounded-xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
                        <FolderOpen className="w-8 h-8 text-slate-500 mx-auto" />
                        <p className="text-xs text-slate-300 font-medium">No files found matching criteria</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Try switching filters or search terms, or create a new philosophical document in Google Docs.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-900/30">
                        {files.map((file) => {
                          const isDoc = file.mimeType === GOOGLE_DOCS_MIME;
                          const isIngesting = ingestingFileId === file.id;

                          return (
                            <div
                              key={file.id}
                              className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                    isDoc
                                      ? 'bg-blue-950/80 text-blue-400 border-blue-500/40'
                                      : 'bg-slate-900 text-cyan-400 border-slate-700'
                                  }`}
                                >
                                  {isDoc ? <FileText className="w-4 h-4" /> : <File className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition">
                                      {file.name}
                                    </span>
                                    {isDoc && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/40">
                                        Google Doc
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                                    {file.modifiedTime && (
                                      <span>
                                        Modified: {new Date(file.modifiedTime).toLocaleDateString()}
                                      </span>
                                    )}
                                    {file.size && (
                                      <span>• {(parseInt(file.size, 10) / 1024).toFixed(1)} KB</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                {/* Ingest Action */}
                                <button
                                  type="button"
                                  onClick={() => handleIngestDriveFile(file)}
                                  disabled={isIngesting}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                  title="Ingest document content and build epistemic nodes"
                                >
                                  {isIngesting ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isIngesting ? 'Ingesting...' : 'Ingest to Graph'}</span>
                                </button>

                                {/* Open Link */}
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                                    title="Open in Google Drive / Docs"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                {/* Delete / Trash Button (Triggers mandatory user confirmation) */}
                                <button
                                  type="button"
                                  onClick={() => setFileToDelete(file)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Move file to Google Drive trash"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: EXPORT KNOWLEDGE GRAPH TO GOOGLE DOCS */}
                {activeTab === 'export' && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>Export Epistemic Dossier to Google Docs</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        This operation generates a new Google Doc in your Google Drive containing structured sections,
                        philosophical stages, node definitions, verbatim textual citations, and dialectical relata.
                      </p>

                      <div className="space-y-1.5 pt-2">
                        <label className="text-[11px] font-mono text-slate-400 block">Document Title</label>
                        <input
                          type="text"
                          value={exportTitle}
                          onChange={(e) => setExportTitle(e.target.value)}
                          placeholder="e.g. Nihiltheism Research Dossier"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <label className="text-[11px] font-mono text-slate-400 block">Export Scope</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            {
                              id: 'all',
                              title: 'Complete Topology',
                              desc: 'All baseline nodes and ingested documents'
                            },
                            {
                              id: 'ingested',
                              title: 'Ingested Corpus Only',
                              desc: 'Only documents uploaded via Ingestion engine'
                            },
                            {
                              id: 'selected',
                              title: 'Selected Node Dossier',
                              desc: selectedNode ? `Focus: "${selectedNode.title}"` : 'Select a node on canvas first'
                            }
                          ].map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setExportScope(option.id as any)}
                              disabled={option.id === 'selected' && !selectedNode}
                              className={`p-3 rounded-lg text-left border transition text-xs ${
                                exportScope === option.id
                                  ? 'bg-blue-950/70 text-blue-200 border-blue-500/50 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                              } disabled:opacity-40`}
                            >
                              <div className="font-semibold text-slate-200">{option.title}</div>
                              <div className="text-[10px] text-slate-400 mt-1">{option.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={handleExportToGoogleDoc}
                          disabled={isExporting}
                          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/40 shadow-lg shadow-blue-900/30 flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {isExporting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                          <span>{isExporting ? 'Creating Google Doc...' : 'Export to Google Docs'}</span>
                        </button>

                        {exportedDocLink && (
                          <a
                            href={exportedDocLink.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-500/50 flex items-center gap-1.5 hover:bg-emerald-900/80 transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open "{exportedDocLink.title}" in Docs</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: CREATE NEW GOOGLE DOC */}
                {activeTab === 'create' && (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
                    <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-purple-400" />
                      <span>Create New Google Doc in Google Drive</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Instantly initialize a new research draft or chapter manuscript in Google Docs. Once created, you
                      can write your philosophical dialectic and ingest it back into this graph at any time.
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-mono text-slate-400 block">Manuscript Title</label>
                      <input
                        type="text"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        placeholder="e.g. Chapter 18: The Trans-Nihiltheistic Turn"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCreateNewDoc}
                        disabled={isCreatingDoc}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/40 shadow-lg shadow-purple-900/30 flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isCreatingDoc ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>{isCreatingDoc ? 'Creating Doc...' : 'Create Google Doc'}</span>
                      </button>

                      {createdDocLink && (
                        <a
                          href={createdDocLink.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-purple-950/70 border border-purple-500/50 flex items-center gap-1.5 hover:bg-purple-900/80 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open "{createdDocLink.title}" in Docs</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory User Confirmation Modal for Destructive Delete (Invariant per Workspace Skill) */}
      <ConfirmModal
        isOpen={Boolean(fileToDelete)}
        title="Move File to Google Drive Trash?"
        message={`Are you sure you want to move "${fileToDelete?.name}" to your Google Drive trash? You can restore it later from your Google Drive Trash folder.`}
        itemDetails={fileToDelete ? [`${fileToDelete.name} (${fileToDelete.mimeType})`] : []}
        confirmLabel="Move to Trash"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFileToDelete(null)}
      />
    </>
  );
};
