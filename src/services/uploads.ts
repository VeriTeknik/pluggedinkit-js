import { AxiosInstance } from 'axios';
import FormData from 'form-data';
import {
  ClientConfig,
  UploadMetadata,
  UploadResponse,
  UploadProgress,
  Document,
  PluggedInError
} from '../types';

export class UploadService {
  private uploadTrackers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Upload a file to the library
   */
  async uploadFile(
    file: File | Buffer | Blob,
    metadata: {
      name: string;
      description?: string;
      tags?: string[];
      purpose?: string;
      relatedTo?: string;
      notes?: string;
    },
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = this.createFormData(file, metadata);

    const response = await this.axios.post<UploadResponse>(
      '/api/library/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      }
    );

    if (!response.data.success) {
      throw new PluggedInError(
        response.data.error || 'Failed to upload file'
      );
    }

    return response.data;
  }

  /**
   * Upload a document with content directly (for AI-generated content)
   */
  async uploadDocument(
    content: string,
    metadata: UploadMetadata
  ): Promise<Document> {
    const response = await this.axios.post<any>(
      '/api/documents',
      {
        title: metadata.title,
        content,
        description: metadata.description,
        tags: metadata.tags,
        category: metadata.category,
        format: metadata.format || 'md',
        metadata: metadata.metadata,
      }
    );

    if (!response.data.success) {
      throw new PluggedInError(
        response.data.error || 'Failed to upload document'
      );
    }

    return this.transformDocument(response.data.document);
  }

  /**
   * Upload multiple files in batch
   */
  async uploadBatch(
    files: Array<{
      file: File | Buffer | Blob;
      metadata: {
        name: string;
        description?: string;
        tags?: string[];
      };
    }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<UploadResponse[]> {
    const results: UploadResponse[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const { file, metadata } = files[i]!;

      try {
        const result = await this.uploadFile(file, metadata);
        results.push(result);

        if (onProgress) {
          onProgress(i + 1, total);
        }
      } catch (error) {
        // Continue with other uploads even if one fails
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        });

        if (onProgress) {
          onProgress(i + 1, total);
        }
      }
    }

    return results;
  }

  /**
   * Check upload status
   */
  async checkUploadStatus(uploadId: string): Promise<UploadProgress> {
    const response = await this.axios.get<any>(
      `/api/upload-status/${uploadId}`
    );

    return {
      uploadId,
      status: response.data.status || 'pending',
      progress: response.data.progress,
      message: response.data.message,
      error: response.data.error,
    };
  }

  /**
   * Track upload progress with polling
   */
  async trackUpload(
    uploadId: string,
    onUpdate: (progress: UploadProgress) => void,
    pollInterval: number = 1000
  ): Promise<void> {
    // Clear any existing tracker for this upload
    this.stopTracking(uploadId);

    const poll = async () => {
      try {
        const status = await this.checkUploadStatus(uploadId);
        onUpdate(status);

        if (status.status === 'completed' || status.status === 'failed') {
          this.stopTracking(uploadId);
        }
      } catch (error) {
        onUpdate({
          uploadId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to check status',
        });
        this.stopTracking(uploadId);
      }
    };

    // Initial poll
    await poll();

    // Set up interval for subsequent polls
    if (this.uploadTrackers.has(uploadId)) {
      const interval = setInterval(poll, pollInterval);
      this.uploadTrackers.set(uploadId, interval);
    }
  }

  /**
   * Stop tracking an upload
   */
  stopTracking(uploadId: string): void {
    const interval = this.uploadTrackers.get(uploadId);
    if (interval) {
      clearInterval(interval);
      this.uploadTrackers.delete(uploadId);
    }
  }

  /**
   * Stop tracking all uploads
   */
  stopAllTracking(): void {
    for (const interval of this.uploadTrackers.values()) {
      clearInterval(interval);
    }
    this.uploadTrackers.clear();
  }

  /**
   * Create FormData for file upload
   */
  private createFormData(
    file: File | Buffer | Blob,
    metadata: {
      name: string;
      description?: string;
      tags?: string[];
      purpose?: string;
      relatedTo?: string;
      notes?: string;
    }
  ): FormData {
    const formData = new FormData();

    // Handle different file types
    if (file instanceof File) {
      formData.append('file', file, file.name);
    } else if (Buffer.isBuffer(file)) {
      formData.append('file', file, metadata.name);
    } else if (file instanceof Blob) {
      formData.append('file', file, metadata.name);
    } else {
      throw new PluggedInError('Invalid file type');
    }

    // Add metadata
    formData.append('name', metadata.name);
    if (metadata.description) {
      formData.append('description', metadata.description);
    }
    if (metadata.tags && metadata.tags.length > 0) {
      formData.append('tags', metadata.tags.join(','));
    }
    if (metadata.purpose) {
      formData.append('purpose', metadata.purpose);
    }
    if (metadata.relatedTo) {
      formData.append('relatedTo', metadata.relatedTo);
    }
    if (metadata.notes) {
      formData.append('notes', metadata.notes);
    }

    return formData;
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
        timestamp: new Date(attr.timestamp),
      })),
    };
  }
}