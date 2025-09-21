/**
 * Plugged.in Library SDK for JavaScript/TypeScript
 *
 * Official SDK for interacting with Plugged.in's document library and RAG capabilities.
 */

export { PluggedInClient } from './client';
export { PluggedInClient as default } from './client';

// Services
export { DocumentService } from './services/documents';
export { RagService } from './services/rag';
export { UploadService } from './services/uploads';

// Types and interfaces
export type {
  ClientConfig,
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