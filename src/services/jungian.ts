import { AxiosInstance } from 'axios';
import {
  ClientConfig,
  IndividuationResponse,
  ArchetypeSearchResponse,
  SynchronicityPattern,
  DreamConsolidation,
} from '../types';

export class JungianService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Search memory with archetype context injection
   */
  async searchWithContext(params: {
    query: string;
    toolName?: string;
    outcome?: string;
    includeArchetypes?: boolean;
  }): Promise<ArchetypeSearchResponse> {
    const { data } = await this.axios.post('/api/memory/archetype/inject', {
      query: params.query,
      tool_name: params.toolName,
      outcome: params.outcome,
    });
    return data;
  }

  /**
   * Get the current individuation score
   */
  async getIndividuationScore(): Promise<IndividuationResponse> {
    const { data } = await this.axios.get('/api/memory/individuation');
    return data;
  }

  /**
   * Get individuation score history
   */
  async getIndividuationHistory(days?: number): Promise<IndividuationResponse[]> {
    const { data } = await this.axios.get('/api/memory/individuation', {
      params: { history: true, days },
    });
    return data;
  }

  /**
   * Get synchronicity patterns across profiles
   */
  async getSynchronicityPatterns(): Promise<SynchronicityPattern[]> {
    const { data } = await this.axios.get('/api/memory/sync/patterns');
    return data;
  }

  /**
   * Get dream consolidation history
   */
  async getDreamHistory(): Promise<DreamConsolidation[]> {
    const { data } = await this.axios.get('/api/memory/dream/history');
    return data;
  }
}
