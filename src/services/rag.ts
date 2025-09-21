import { AxiosInstance } from 'axios';
import {
  ClientConfig,
  RagResponse,
  RagSourceDocument,
  PluggedInError
} from '../types';

export class RagService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Query the knowledge base with a natural language question
   */
  async query(query: string, projectUuid?: string): Promise<RagResponse> {
    try {
      // Try using the library endpoint first (if available)
      const response = await this.axios.post<any>(
        '/api/library/rag/query',
        {
          query,
          projectUuid
        }
      );

      return this.transformRagResponse(response.data);
    } catch (error) {
      // Fallback to documents endpoint if library endpoint is not available
      if (this.config.debug) {
        console.log('[PluggedIn SDK] Falling back to documents RAG endpoint');
      }

      const response = await this.axios.post<any>(
        '/api/documents/rag/query',
        {
          query,
          projectUuid
        }
      );

      return this.transformRagResponse(response.data);
    }
  }

  /**
   * Query knowledge base and get only the answer text
   */
  async askQuestion(query: string, projectUuid?: string): Promise<string> {
    const response = await this.query(query, projectUuid);

    if (!response.success || !response.answer) {
      throw new PluggedInError(
        response.error || 'No answer received from knowledge base'
      );
    }

    return response.answer;
  }

  /**
   * Query knowledge base and get answer with source documents
   */
  async queryWithSources(
    query: string,
    projectUuid?: string
  ): Promise<{
    answer: string;
    sources: RagSourceDocument[];
  }> {
    const response = await this.query(query, projectUuid);

    if (!response.success || !response.answer) {
      throw new PluggedInError(
        response.error || 'No answer received from knowledge base'
      );
    }

    return {
      answer: response.answer,
      sources: response.documents || []
    };
  }

  /**
   * Get relevant documents for a query without generating an answer
   */
  async findRelevantDocuments(
    query: string,
    projectUuid?: string,
    limit: number = 5
  ): Promise<RagSourceDocument[]> {
    const response = await this.axios.post<any>(
      '/api/documents/rag/search',
      {
        query,
        projectUuid,
        limit,
        returnAnswer: false
      }
    );

    if (!response.data.success) {
      throw new PluggedInError(
        response.data.error || 'Failed to search documents'
      );
    }

    return response.data.documents || [];
  }

  /**
   * Check if RAG is available and configured
   */
  async checkAvailability(): Promise<{
    available: boolean;
    message?: string;
  }> {
    try {
      const response = await this.axios.get<any>('/api/rag/health');

      return {
        available: response.data.available || false,
        message: response.data.message
      };
    } catch (error) {
      return {
        available: false,
        message: 'RAG service is not available'
      };
    }
  }

  /**
   * Get RAG storage statistics
   */
  async getStorageStats(projectUuid?: string): Promise<{
    documentCount: number;
    totalSize: number;
    vectorCount?: number;
    lastUpdated?: Date;
  }> {
    const response = await this.axios.get<any>(
      '/api/rag/stats',
      {
        params: projectUuid ? { projectUuid } : undefined
      }
    );

    return {
      documentCount: response.data.documentCount || 0,
      totalSize: response.data.totalSize || 0,
      vectorCount: response.data.vectorCount,
      lastUpdated: response.data.lastUpdated
        ? new Date(response.data.lastUpdated)
        : undefined
    };
  }

  /**
   * Refresh RAG index for a specific document
   */
  async refreshDocument(
    documentId: string,
    projectUuid?: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await this.axios.post<any>(
      `/api/rag/refresh/${documentId}`,
      {
        projectUuid
      }
    );

    return {
      success: response.data.success || false,
      message: response.data.message
    };
  }

  /**
   * Remove a document from the RAG index
   */
  async removeDocument(
    documentId: string,
    projectUuid?: string
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await this.axios.delete<any>(
      `/api/rag/documents/${documentId}`,
      {
        data: { projectUuid }
      }
    );

    return {
      success: response.data.success || false,
      message: response.data.message
    };
  }

  /**
   * Transform API response to RagResponse type
   */
  private transformRagResponse(data: any): RagResponse {
    // Handle different response formats from API
    if (data.success !== undefined) {
      // Already in expected format
      return data;
    }

    // Transform legacy format
    if (data.answer || data.results) {
      return {
        success: true,
        answer: data.answer || data.results,
        sources: data.sources || [],
        documentIds: data.documentIds || data.document_ids || [],
        documents: data.documents || []
      };
    }

    // Error response
    return {
      success: false,
      error: data.error || 'Unknown error occurred'
    };
  }
}