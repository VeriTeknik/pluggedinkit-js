import { AxiosInstance } from 'axios';
import {
  ClientConfig,
  Document,
  DocumentWithContent,
  DocumentVersion,
  DocumentListResponse,
  DocumentFilters,
  PaginationOptions,
  SearchResponse,
  SearchFilters,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
  PluggedInError
} from '../types';

export class DocumentService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * List documents with optional filters
   */
  async list(
    filters?: DocumentFilters & PaginationOptions
  ): Promise<DocumentListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      // Add filters to query params
      if (filters.source) params.append('source', filters.source);
      if (filters.modelName) params.append('modelName', filters.modelName);
      if (filters.modelProvider) params.append('modelProvider', filters.modelProvider);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.category) params.append('category', filters.category);
      if (filters.visibility) params.append('visibility', filters.visibility);
      if (filters.searchQuery) params.append('searchQuery', filters.searchQuery);
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
      if (filters.offset !== undefined) params.append('offset', filters.offset.toString());

      // Handle tags array
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag));
      }
    }

    const response = await this.axios.get<DocumentListResponse>(
      '/api/documents',
      { params }
    );

    // Convert date strings to Date objects
    return {
      ...response.data,
      documents: response.data.documents.map(doc => this.transformDocument(doc))
    };
  }

  /**
   * Search documents semantically
   */
  async search(
    query: string,
    filters?: SearchFilters,
    limit: number = 10,
    offset: number = 0
  ): Promise<SearchResponse> {
    const response = await this.axios.post<SearchResponse>(
      '/api/documents/search',
      {
        query,
        filters,
        limit,
        offset
      }
    );

    // Transform dates in results
    return {
      ...response.data,
      results: response.data.results.map(result => ({
        ...result,
        createdAt: new Date(result.createdAt)
      }))
    };
  }

  /**
   * Get a single document by ID
   */
  async get(
    documentId: string,
    options?: {
      includeContent?: boolean;
      includeVersions?: boolean;
    }
  ): Promise<DocumentWithContent | Document> {
    const params = new URLSearchParams();
    if (options?.includeContent) params.append('includeContent', 'true');
    if (options?.includeVersions) params.append('includeVersions', 'true');

    const response = await this.axios.get<any>(
      `/api/documents/${documentId}`,
      { params }
    );

    const doc = this.transformDocument({
      id: response.data.id,
      title: response.data.title,
      description: response.data.description,
      fileName: response.data.fileName,
      fileSize: response.data.fileSize,
      mimeType: response.data.mimeType,
      tags: response.data.tags,
      source: response.data.source,
      visibility: response.data.visibility,
      version: response.data.version,
      createdAt: response.data.createdAt,
      updatedAt: response.data.updatedAt,
      aiMetadata: response.data.aiMetadata,
      modelAttributions: response.data.modelAttributions,
      contentHash: response.data.contentHash,
      parentDocumentId: response.data.parentDocumentId,
    });

    if (options?.includeContent && response.data.content) {
      return {
        ...doc,
        content: response.data.content,
        contentEncoding: response.data.contentEncoding
      } as DocumentWithContent;
    }

    return doc;
  }

  /**
   * Update an existing document
   */
  async update(
    documentId: string,
    request: UpdateDocumentRequest
  ): Promise<UpdateDocumentResponse> {
    const response = await this.axios.patch<UpdateDocumentResponse>(
      `/api/documents/${documentId}`,
      request
    );

    return response.data;
  }

  /**
   * Delete a document
   */
  async delete(documentId: string): Promise<void> {
    await this.axios.delete(`/api/documents/${documentId}`);
  }

  /**
   * Download a document file
   */
  async download(
    documentId: string,
    options?: {
      projectUuid?: string;
    }
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (options?.projectUuid) {
      params.append('projectUuid', options.projectUuid);
    }

    const response = await this.axios.get(
      `/api/library/download/${documentId}`,
      {
        params,
        responseType: 'blob'
      }
    );

    return response.data;
  }

  /**
   * Get document versions
   */
  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    const response = await this.axios.get<any>(
      `/api/documents/${documentId}`,
      {
        params: { includeVersions: 'true' }
      }
    );

    if (!response.data.versions) {
      return [];
    }

    return response.data.versions.map((v: any) => ({
      versionNumber: v.versionNumber,
      createdAt: new Date(v.createdAt),
      createdByModel: v.createdByModel,
      changeSummary: v.changeSummary,
      contentDiff: v.contentDiff,
    }));
  }

  /**
   * Get a specific version of a document
   */
  async getVersion(
    documentId: string,
    versionNumber: number
  ): Promise<DocumentWithContent> {
    const response = await this.axios.get<any>(
      `/api/documents/${documentId}/versions/${versionNumber}`
    );

    return {
      ...this.transformDocument(response.data),
      content: response.data.content,
      contentEncoding: response.data.contentEncoding
    } as DocumentWithContent;
  }

  /**
   * Create a new AI-generated document
   */
  async create(
    title: string,
    content: string,
    metadata: {
      format?: 'md' | 'txt' | 'json' | 'html';
      category?: 'report' | 'analysis' | 'documentation' | 'guide' | 'research' | 'code' | 'other';
      tags?: string[];
      model: {
        name: string;
        provider: string;
        version?: string;
      };
      context?: string;
      conversationContext?: string[];
      generationParams?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
      };
      prompt?: string;
      sourceDocuments?: string[];
      visibility?: 'private' | 'workspace' | 'public';
    }
  ): Promise<Document> {
    const response = await this.axios.post<any>(
      '/api/documents/ai',
      {
        title,
        content,
        format: metadata.format || 'md',
        category: metadata.category || 'other',
        tags: metadata.tags,
        metadata: {
          model: metadata.model,
          context: metadata.context,
          conversationContext: metadata.conversationContext,
          generationParams: metadata.generationParams,
          prompt: metadata.prompt,
          sourceDocuments: metadata.sourceDocuments,
          visibility: metadata.visibility || 'private',
        }
      }
    );

    if (!response.data?.success) {
      throw new PluggedInError(response.data?.error || 'Failed to create document');
    }

    const documentId: string | undefined = response.data.documentId;
    if (!documentId) {
      throw new PluggedInError('Server did not return a document id');
    }

    const created = await this.get(documentId);
    return created as Document;
  }

  /**
   * Transform API response to Document type
   */
  private transformDocument(data: any): Document {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      modelAttributions: data.modelAttributions?.map((attr: any) => ({
        ...attr,
        timestamp: new Date(attr.timestamp)
      }))
    };
  }
}
