import { AxiosError, AxiosInstance } from 'axios';
import {
  ClientConfig,
  PluggedInError,
  RagResponse,
  RagSourceDocument,
  RagStorageStats,
} from '../types';

export interface RagQueryOptions {
  includeMetadata?: boolean;
}

export class RagService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Query the knowledge base with a natural language question.
   * The new `/api/rag/query` endpoint defaults to returning plain text. By
   * enabling metadata we receive structured fields such as sources and ids.
   */
  async query(query: string, options: RagQueryOptions = {}): Promise<RagResponse> {
    const includeMetadata = options.includeMetadata ?? true;

    try {
      const response = await this.axios.post<any>(
        '/api/rag/query',
        {
          query,
          includeMetadata,
        },
        {
          responseType: includeMetadata ? 'json' : 'text',
          transformResponse: includeMetadata ? undefined : (value) => value,
        }
      );

      return this.normaliseRagResponse(response.data);
    } catch (error) {
      throw this.toRagError(error, 'query knowledge base');
    }
  }

  /**
   * Query knowledge base and return only the answer text.
   */
  async askQuestion(query: string): Promise<string> {
    const response = await this.query(query, { includeMetadata: false });

    if (!response.success || response.answer === undefined) {
      throw new PluggedInError(
        response.error || 'No answer received from knowledge base'
      );
    }

    return response.answer;
  }

  /**
   * Query knowledge base and return the answer with formatted sources.
   */
  async queryWithSources(
    query: string
  ): Promise<{
    answer: string;
    sources: RagSourceDocument[];
  }> {
    const response = await this.query(query, { includeMetadata: true });

    if (!response.success || !response.answer) {
      throw new PluggedInError(
        response.error || 'No answer received from knowledge base'
      );
    }

    return {
      answer: response.answer,
      sources: response.documents ?? [],
    };
  }

  /**
   * Retrieve documents relevant to a query.
   */
  async findRelevantDocuments(query: string): Promise<RagSourceDocument[]> {
    const response = await this.query(query, { includeMetadata: true });

    if (!response.success) {
      throw new PluggedInError(
        response.error || 'Failed to retrieve relevant documents'
      );
    }

    return response.documents ?? [];
  }

  /**
   * Perform a lightweight availability check against the RAG service.
   */
  async checkAvailability(): Promise<{ available: boolean; message?: string }> {
    try {
      await this.query('__pluggedin_health_check__', { includeMetadata: false });
      return { available: true };
    } catch (error) {
      if (this.config.debug) {
        console.error('[PluggedIn SDK] RAG health check failed:', error);
      }

      return {
        available: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch RAG storage statistics for the authenticated user.
   * @param userId The Plugged.in user id associated with the API key.
   */
  async getStorageStats(userId: string): Promise<RagStorageStats> {
    if (!userId) {
      throw new PluggedInError('userId is required to fetch storage statistics');
    }

    try {
      const response = await this.axios.get<any>(
        '/api/rag/storage-stats',
        {
          params: { user_id: userId },
        }
      );

      const data = response.data ?? {};
      return {
        documentsCount: data.documents_count ?? 0,
        totalChunks: data.total_chunks ?? 0,
        estimatedStorageMb: data.estimated_storage_mb ?? 0,
        vectorsCount: data.vectors_count,
        embeddingDimension: data.embedding_dimension,
        isEstimate: data.is_estimate ?? true,
      };
    } catch (error) {
      throw this.toRagError(error, 'fetch storage statistics');
    }
  }

  /**
   * The public API no longer exposes explicit refresh operations.
   */
  async refreshDocument(): Promise<never> {
    throw new PluggedInError(
      'Document refresh is no longer available via the public API.'
    );
  }

  /**
   * The public API no longer exposes document removal operations.
   */
  async removeDocument(): Promise<never> {
    throw new PluggedInError(
      'Document removal from the RAG index is no longer available via the public API.'
    );
  }

  private normaliseRagResponse(payload: any): RagResponse {
    if (typeof payload === 'string') {
      return {
        success: true,
        answer: payload,
        sources: [],
        documentIds: [],
        documents: [],
      };
    }

    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        error: 'Unexpected response format from RAG query endpoint',
      };
    }

    const answer =
      payload.answer ??
      payload.response ??
      payload.results ??
      payload.message ??
      '';

    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const documentIds = Array.isArray(payload.documentIds)
      ? payload.documentIds
      : Array.isArray(payload.document_ids)
      ? payload.document_ids
      : [];

    const documents: RagSourceDocument[] = documentIds.map((id: string, index: number) => ({
      id,
      name: sources[index] ?? `Document ${index + 1}`,
    }));

    return {
      success: payload.success ?? true,
      answer,
      sources,
      documentIds,
      documents,
      error: payload.error,
    };
  }

  private toRagError(error: unknown, action: string): PluggedInError {
    if (error instanceof PluggedInError) {
      return error;
    }

    if ((error as AxiosError)?.isAxiosError) {
      const axiosError = error as AxiosError<any>;

      if (axiosError.response) {
        const message =
          axiosError.response.data?.error ||
          axiosError.response.data?.message ||
          `Failed to ${action}`;
        return new PluggedInError(
          message,
          axiosError.response.status,
          axiosError.response.data?.details ?? axiosError.response.data
        );
      }

      if (axiosError.request) {
        return new PluggedInError(
          `No response received while attempting to ${action}`
        );
      }
    }

    return new PluggedInError(
      error instanceof Error ? error.message : `Unable to ${action}`
    );
  }
}
