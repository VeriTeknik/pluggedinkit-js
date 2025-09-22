/**
 * Common types and interfaces for Plugged.in Library SDK
 */

export interface ClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  debug?: boolean;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface DocumentFilters {
  source?: 'all' | 'upload' | 'ai_generated' | 'api';
  modelName?: string;
  modelProvider?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  category?: string;
  visibility?: 'all' | 'private' | 'workspace' | 'public';
  searchQuery?: string;
  sort?: 'date_desc' | 'date_asc' | 'title' | 'size';
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tags: string[];
  source: 'upload' | 'ai_generated' | 'api';
  visibility: 'private' | 'workspace' | 'public';
  version: number;
  createdAt: Date;
  updatedAt: Date;
  aiMetadata?: AIMetadata;
  modelAttributions?: ModelAttribution[];
  contentHash?: string;
  parentDocumentId?: string;
}

export interface DocumentWithContent extends Document {
  content: string;
  contentEncoding: 'utf-8' | 'base64';
}

export interface DocumentVersion {
  versionNumber: number;
  createdAt: Date;
  createdByModel?: ModelInfo;
  changeSummary?: string;
  contentDiff?: string;
}

export interface AIMetadata {
  model?: ModelInfo;
  timestamp?: string;
  context?: string;
  generationParams?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  prompt?: string;
  conversationContext?: string[] | Array<{ role: string; content: string }>;
  updateReason?: string;
  changesFromPrompt?: string;
  changeSummary?: string;
  sourceDocuments?: string[];
  visibility?: string;
  sessionId?: string;
  lastUpdatedBy?: ModelInfo;
  lastUpdateTimestamp?: string;
  [key: string]: any; // Allow additional fields
}

export interface ModelInfo {
  name: string;
  provider: string;
  version?: string;
}

export interface ModelAttribution {
  modelName: string;
  modelProvider: string;
  contributionType: 'created' | 'updated' | 'reviewed';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchFilters {
  modelName?: string;
  modelProvider?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  source?: 'all' | 'upload' | 'ai_generated' | 'api';
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  snippet: string;
  relevanceScore: number;
  source: string;
  aiMetadata?: AIMetadata;
  tags: string[];
  visibility: string;
  createdAt: Date;
  modelAttributions?: ModelAttribution[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface UpdateDocumentRequest {
  operation: 'replace' | 'append' | 'prepend';
  content: string;
  metadata?: {
    changeSummary?: string;
    model: ModelInfo;
    tags?: string[];
    updateReason?: string;
    changesFromPrompt?: string;
    prompt?: string;
    conversationContext?: string[] | Array<{ role: string; content: string }>;
    sourceDocuments?: string[];
    visibility?: string;
    sessionId?: string;
    lastUpdatedBy?: ModelInfo;
    lastUpdateTimestamp?: string;
    [key: string]: any; // Allow additional fields
  };
}

export interface UpdateDocumentResponse {
  success: boolean;
  documentId: string;
  version: number;
  fileWritten: boolean;
  message?: string;
}

export interface UploadMetadata {
  title: string;
  description?: string;
  tags?: string[];
  category?: 'report' | 'analysis' | 'documentation' | 'guide' | 'research' | 'code' | 'other';
  format?: 'md' | 'txt' | 'json' | 'html';
  metadata?: {
    model: ModelInfo;
    context?: string;
    conversationContext?: string[] | Array<{ role: string; content: string }>;
    generationParams?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    };
    prompt?: string;
    sourceDocuments?: string[];
    visibility?: 'private' | 'workspace' | 'public';
    updateReason?: string;
    changesFromPrompt?: string;
    changeSummary?: string;
    sessionId?: string;
    lastUpdatedBy?: ModelInfo;
    lastUpdateTimestamp?: string;
    [key: string]: any; // Allow additional fields
  };
}

export interface UploadResponse {
  success: boolean;
  documentId?: string;
  uploadId?: string;
  ragProcessed?: boolean;
  ragError?: string;
  error?: string;
}

export interface UploadProgress {
  uploadId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
}

export interface RagQuery {
  query: string;
  projectUuid?: string;
}

export interface RagResponse {
  success: boolean;
  answer?: string;
  sources?: string[];
  documentIds?: string[];
  documents?: RagSourceDocument[];
  error?: string;
}

export interface RagSourceDocument {
  id: string;
  name: string;
  relevance?: number;
  model?: ModelInfo;
  source?: string;
  isUnresolved?: boolean;
}

export interface ApiError {
  error: string;
  details?: any;
  status?: number;
}

export class PluggedInError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'PluggedInError';
  }
}

export class RateLimitError extends PluggedInError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends PluggedInError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends PluggedInError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}