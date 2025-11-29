/**
 * Plugged.in Library SDK for JavaScript/TypeScript
 *
 * Official SDK for interacting with Plugged.in's document library and RAG capabilities.
 */

export { PluggedInClient } from './client';
export { PluggedInClient as default } from './client';

// Services
export { ClipboardService } from './services/clipboard';
export { DocumentService } from './services/documents';
export { RagService } from './services/rag';
export { UploadService } from './services/uploads';

// Types and interfaces
export type {
  ClientConfig,
  // Clipboard types
  ClipboardSource,
  ClipboardEntry,
  ClipboardListResponse,
  ClipboardSetRequest,
  ClipboardPushRequest,
  ClipboardGetFilters,
  ClipboardDeleteRequest,
  ClipboardResponse,
  ClipboardDeleteResponse,
  // Document types
  Document,
  DocumentWithContent,
  DocumentVersion,
  DocumentListResponse,
  DocumentFilters,
  PaginationOptions,
  SearchResponse,
  SearchResult,
  SearchFilters,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
  UploadMetadata,
  UploadResponse,
  UploadProgress,
  RagQuery,
  RagResponse,
  RagSourceDocument,
  AIMetadata,
  ModelInfo,
  ModelAttribution,
  ApiError,
} from './types';

// Error classes
export {
  PluggedInError,
  RateLimitError,
  AuthenticationError,
  NotFoundError,
} from './types';

// Constants
export { DEFAULT_CLIPBOARD_SOURCE } from './types';