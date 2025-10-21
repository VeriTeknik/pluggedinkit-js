import { AxiosInstance } from 'axios';
import {
  ClientConfig,
  DocumentWithContent,
  PluggedInError,
  UploadMetadata,
  UploadResponse,
} from '../types';

export class UploadService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Binary file uploads are no longer exposed through the public API.
   * We throw an explicit error rather than silently failing so callers
   * can migrate to the supported flows.
   */
  async uploadFile(): Promise<never> {
    throw new PluggedInError(
      'Binary file uploads are no longer supported via the API. ' +
        'Please use the Plugged.in web interface or the forthcoming upload workflow.'
    );
  }

  /**
   * Upload an AI generated document directly.
   * The new `/api/documents/ai` endpoint returns only identifiers, so we fetch
   * the created document afterwards to provide a fully populated object.
   */
  async uploadDocument(
    content: string,
    metadata: UploadMetadata
  ): Promise<DocumentWithContent> {
    const response = await this.axios.post<any>(
      '/api/documents/ai',
      {
        title: metadata.title,
        content,
        description: metadata.description,
        tags: metadata.tags,
        category: metadata.category ?? 'other',
        format: metadata.format ?? 'md',
        metadata: metadata.metadata,
      }
    );

    if (!response.data?.success) {
      throw new PluggedInError(
        response.data?.error || 'Failed to create AI document'
      );
    }

    const documentId: string | undefined = response.data.documentId;
    if (!documentId) {
      throw new PluggedInError('Server did not return a document id');
    }

    const documentResponse = await this.axios.get<any>(
      `/api/documents/${documentId}`,
      {
        params: { includeContent: 'true' },
      }
    );

    return this.transformDocument(documentResponse.data);
  }

  /**
   * Batch uploads are no longer available via the API.
   */
  async uploadBatch(): Promise<UploadResponse[]> {
    throw new PluggedInError(
      'Batch uploads are no longer supported via the API.'
    );
  }

  /**
   * Upload status polling was removed alongside the legacy upload pipeline.
   */
  async checkUploadStatus(): Promise<never> {
    throw new PluggedInError(
      'Upload status tracking is no longer available via the API.'
    );
  }

  /**
   * Upload tracking is no longer available but retained for backwards compatibility.
   */
  async trackUpload(): Promise<never> {
    throw new PluggedInError(
      'Upload status tracking is no longer available via the API.'
    );
  }

  stopTracking(): void {
    if (this.config.debug) {
      console.warn('[PluggedIn SDK] stopTracking is a no-op in the current API.');
    }
  }

  stopAllTracking(): void {
    if (this.config.debug) {
      console.warn('[PluggedIn SDK] stopAllTracking is a no-op in the current API.');
    }
  }

  private transformDocument(data: any): DocumentWithContent {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      tags: data.tags ?? [],
      source: data.source,
      visibility: data.visibility,
      version: data.version,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      aiMetadata: data.aiMetadata,
      modelAttributions: data.modelAttributions?.map((attr: any) => ({
        ...attr,
        timestamp: new Date(attr.timestamp),
      })),
      contentHash: data.contentHash,
      parentDocumentId: data.parentDocumentId,
      content: data.content,
      contentEncoding: data.contentEncoding ?? 'utf-8',
    };
  }
}
