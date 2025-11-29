import { AxiosInstance } from 'axios';
import {
  ClientConfig,
  ClipboardEntry,
  ClipboardListResponse,
  ClipboardSetRequest,
  ClipboardPushRequest,
  ClipboardGetFilters,
  ClipboardDeleteRequest,
  ClipboardResponse,
  ClipboardDeleteResponse,
  PaginationOptions,
  PluggedInError,
  NotFoundError,
  DEFAULT_CLIPBOARD_SOURCE
} from '../types';

// Known error message markers that indicate an empty clipboard (not a real error)
const EMPTY_CLIPBOARD_MARKERS = ['empty', 'no indexed entries'];

export class ClipboardService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Checks if an API response indicates an empty clipboard condition.
   * This centralizes the brittle substring-based detection so backend
   * contract changes only need updates in one place.
   */
  private isEmptyClipboardResponse(responseData?: ClipboardResponse): boolean {
    if (!responseData) return false;

    // Success with no entry = empty
    if (responseData.success && !responseData.entry) return true;

    // Check error message for known empty markers
    const errorMessage = responseData.error?.toLowerCase() ?? '';
    return EMPTY_CLIPBOARD_MARKERS.some(marker => errorMessage.includes(marker));
  }

  /**
   * List clipboard entries with optional filters
   */
  async list(
    filters?: ClipboardGetFilters & PaginationOptions
  ): Promise<ClipboardListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.name) params.append('name', filters.name);
      if (filters.idx !== undefined) params.append('idx', filters.idx.toString());
      if (filters.contentType) params.append('contentType', filters.contentType);
      if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
      if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
    }

    const response = await this.axios.get<any>('/api/clipboard', { params });

    // Transform response - use ?? to preserve 0 values
    return {
      entries: (response.data.entries ?? []).map((entry: any) => this.transformEntry(entry)),
      total: response.data.total ?? 0,
      limit: response.data.limit ?? 50,
      offset: response.data.offset ?? 0
    };
  }

  /**
   * Get a single clipboard entry by name or index
   */
  async get(options: { name?: string; idx?: number }): Promise<ClipboardEntry> {
    if (options.name === undefined && options.idx === undefined) {
      throw new PluggedInError('Either name or idx must be provided');
    }

    const params = new URLSearchParams();
    if (options.name) params.append('name', options.name);
    if (options.idx !== undefined) params.append('idx', options.idx.toString());

    const response = await this.axios.get<any>('/api/clipboard', { params });

    if (!response.data.entry) {
      throw new NotFoundError('Clipboard entry not found');
    }

    return this.transformEntry(response.data.entry);
  }

  /**
   * Get a clipboard entry by name (convenience method)
   */
  async getByName(name: string): Promise<ClipboardEntry> {
    return this.get({ name });
  }

  /**
   * Get a clipboard entry by index (convenience method)
   */
  async getByIndex(idx: number): Promise<ClipboardEntry> {
    return this.get({ idx });
  }

  /**
   * Set a clipboard entry (upsert for named entries)
   */
  async set(request: ClipboardSetRequest): Promise<ClipboardEntry> {
    if (request.name === undefined && request.idx === undefined) {
      throw new PluggedInError('Either name or idx must be provided');
    }

    // Hardcode source: SDK always uses 'sdk' source
    const requestWithSource = {
      ...request,
      source: 'sdk' as const
    };

    const response = await this.axios.post<ClipboardResponse>('/api/clipboard', requestWithSource);

    if (!response.data.success || !response.data.entry) {
      throw new PluggedInError(response.data.error || 'Failed to set clipboard entry');
    }

    return this.transformEntry(response.data.entry);
  }

  /**
   * Push a new entry to the indexed clipboard (auto-increment index)
   */
  async push(request: ClipboardPushRequest): Promise<ClipboardEntry> {
    // Hardcode source: SDK always uses 'sdk' source
    const requestWithSource = {
      ...request,
      source: 'sdk' as const
    };

    const response = await this.axios.post<ClipboardResponse>('/api/clipboard/push', requestWithSource);

    if (!response.data.success || !response.data.entry) {
      throw new PluggedInError(response.data.error || 'Failed to push clipboard entry');
    }

    return this.transformEntry(response.data.entry);
  }

  /**
   * Pop the most recent entry from the indexed clipboard
   * @returns The popped entry, or null if clipboard is empty
   */
  async pop(): Promise<ClipboardEntry | null> {
    try {
      const response = await this.axios.post<ClipboardResponse>('/api/clipboard/pop', {});

      // Success with entry - return it
      if (response.data.success && response.data.entry) {
        return this.transformEntry(response.data.entry);
      }

      // Check for empty clipboard condition using centralized helper
      if (this.isEmptyClipboardResponse(response.data)) {
        return null;
      }

      // Any other non-success response is a real error - throw it
      throw new PluggedInError(response.data.error || 'Failed to pop clipboard entry');
    } catch (error) {
      // 404 means clipboard is empty - this is a valid "not found" case
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete clipboard entries
   */
  async delete(options: ClipboardDeleteRequest): Promise<number> {
    if (!options.clearAll && options.name === undefined && options.idx === undefined) {
      throw new PluggedInError('Either name, idx, or clearAll must be provided');
    }

    const response = await this.axios.delete<ClipboardDeleteResponse>('/api/clipboard', {
      data: options
    });

    if (!response.data.success) {
      throw new PluggedInError(response.data.error || 'Failed to delete clipboard entry');
    }

    return response.data.deleted;
  }

  /**
   * Clear all clipboard entries
   */
  async clearAll(): Promise<number> {
    return this.delete({ clearAll: true });
  }

  /**
   * Transform API response to ClipboardEntry type
   */
  private transformEntry(data: any): ClipboardEntry {
    return {
      uuid: data.uuid,
      name: data.name,
      idx: data.idx,
      value: data.value,
      contentType: data.contentType,
      encoding: data.encoding,
      sizeBytes: data.sizeBytes,
      visibility: data.visibility,
      createdByTool: data.createdByTool,
      createdByModel: data.createdByModel,
      // Default to 'ui' for backward compatibility with older entries
      source: data.source ?? DEFAULT_CLIPBOARD_SOURCE,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null
    };
  }
}
