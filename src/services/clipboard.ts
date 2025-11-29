import { AxiosInstance } from 'axios';
import {
  ClientConfig,
  ClipboardEntry,
  ClipboardApiEntry,
  ClipboardListResponse,
  ClipboardSetRequest,
  ClipboardPushRequest,
  ClipboardGetFilters,
  ClipboardDeleteRequest,
  ClipboardResponse,
  ClipboardDeleteResponse,
  ClipboardListApiResponse,
  PaginationOptions,
  PluggedInError,
  NotFoundError,
  ValidationError,
  DEFAULT_CLIPBOARD_SOURCE,
  DEFAULT_CLIPBOARD_LIST_LIMIT,
  DEFAULT_CLIPBOARD_LIST_OFFSET,
  MAX_CLIPBOARD_TTL_SECONDS,
  MAX_CLIPBOARD_VALUE_SIZE
} from '../types';

/** Known error message markers that indicate an empty clipboard (not a real error) */
const EMPTY_CLIPBOARD_MARKERS = ['empty', 'no indexed entries'];

/**
 * Service for managing clipboard entries in Plugged.in.
 *
 * The clipboard provides persistent key-value and stack-based storage for AI workflows.
 * Entries can be accessed by name (for key-value storage) or by index (for stack operations).
 *
 * @example
 * ```typescript
 * // Set a named entry
 * await client.clipboard.set({ name: 'user_prefs', value: JSON.stringify(prefs) });
 *
 * // Get by name
 * const entry = await client.clipboard.getByName('user_prefs');
 *
 * // Push/pop for stack operations
 * await client.clipboard.push({ value: 'step1' });
 * const step = await client.clipboard.pop();
 * ```
 */
export class ClipboardService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * Validates TTL seconds value.
   * @throws {ValidationError} If ttlSeconds is invalid
   */
  private validateTtlSeconds(ttlSeconds?: number): void {
    if (ttlSeconds === undefined) return;

    if (ttlSeconds < 0) {
      throw new ValidationError('ttlSeconds must be a positive number');
    }
    if (ttlSeconds > MAX_CLIPBOARD_TTL_SECONDS) {
      throw new ValidationError(
        `ttlSeconds must be at most ${MAX_CLIPBOARD_TTL_SECONDS} (1 year)`
      );
    }
  }

  /**
   * Validates value size.
   * @throws {ValidationError} If value exceeds maximum size
   */
  private validateValueSize(value: string): void {
    const sizeBytes = new TextEncoder().encode(value).length;
    if (sizeBytes > MAX_CLIPBOARD_VALUE_SIZE) {
      throw new ValidationError(
        `Value size (${sizeBytes} bytes) exceeds maximum allowed size (${MAX_CLIPBOARD_VALUE_SIZE} bytes / 2MB)`
      );
    }
  }

  /**
   * Checks if an API response indicates an empty clipboard condition.
   *
   * This centralizes the brittle substring-based detection so backend
   * contract changes only need updates in one place. The implementation
   * checks for known error message patterns that indicate the clipboard
   * is empty rather than a real error condition.
   *
   * @internal
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
   * List clipboard entries with optional filters and pagination.
   *
   * @param filters - Optional filters and pagination options
   * @param filters.name - Filter by entry name
   * @param filters.idx - Filter by entry index
   * @param filters.contentType - Filter by content type (e.g., 'application/json')
   * @param filters.limit - Maximum number of entries to return (default: 50)
   * @param filters.offset - Number of entries to skip (default: 0)
   * @returns Paginated list of clipboard entries
   *
   * @example
   * ```typescript
   * // Get first 10 entries
   * const result = await client.clipboard.list({ limit: 10 });
   * console.log(`Total: ${result.total}, Retrieved: ${result.entries.length}`);
   *
   * // Filter by content type
   * const jsonEntries = await client.clipboard.list({ contentType: 'application/json' });
   * ```
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

    const response = await this.axios.get<ClipboardListApiResponse>('/api/clipboard', { params });

    // Transform response - use ?? to preserve 0 values (important for pagination)
    return {
      entries: (response.data.entries ?? []).map((entry) => this.transformEntry(entry)),
      total: response.data.total ?? 0,
      limit: response.data.limit ?? DEFAULT_CLIPBOARD_LIST_LIMIT,
      offset: response.data.offset ?? DEFAULT_CLIPBOARD_LIST_OFFSET
    };
  }

  /**
   * Get a single clipboard entry by name or index.
   *
   * @param options - Lookup options (must specify either name or idx)
   * @param options.name - Entry name for key-value lookup
   * @param options.idx - Entry index for stack-based lookup
   * @returns The clipboard entry
   * @throws {PluggedInError} If neither name nor idx is provided
   * @throws {NotFoundError} If the entry does not exist
   *
   * @example
   * ```typescript
   * // Get by name
   * const prefs = await client.clipboard.get({ name: 'user_preferences' });
   *
   * // Get by index
   * const first = await client.clipboard.get({ idx: 0 });
   * ```
   */
  async get(options: { name?: string; idx?: number }): Promise<ClipboardEntry> {
    if (options.name === undefined && options.idx === undefined) {
      throw new PluggedInError('Either name or idx must be provided');
    }

    const params = new URLSearchParams();
    if (options.name) params.append('name', options.name);
    if (options.idx !== undefined) params.append('idx', options.idx.toString());

    const response = await this.axios.get<ClipboardListApiResponse>('/api/clipboard', { params });

    if (!response.data.entry) {
      throw new NotFoundError('Clipboard entry not found');
    }

    return this.transformEntry(response.data.entry);
  }

  /**
   * Get a clipboard entry by name.
   * Convenience method for key-value style access.
   *
   * @param name - The entry name
   * @returns The clipboard entry
   * @throws {NotFoundError} If the entry does not exist
   *
   * @example
   * ```typescript
   * const config = await client.clipboard.getByName('app_config');
   * ```
   */
  async getByName(name: string): Promise<ClipboardEntry> {
    return this.get({ name });
  }

  /**
   * Get a clipboard entry by index.
   * Convenience method for stack-style access.
   *
   * @param idx - The entry index (0-based)
   * @returns The clipboard entry
   * @throws {NotFoundError} If no entry exists at that index
   *
   * @example
   * ```typescript
   * const firstEntry = await client.clipboard.getByIndex(0);
   * ```
   */
  async getByIndex(idx: number): Promise<ClipboardEntry> {
    return this.get({ idx });
  }

  /**
   * Set a clipboard entry (upsert for named entries).
   *
   * For named entries, this performs an upsert (update if exists, insert if not).
   * For indexed entries, this sets the value at the specified index.
   *
   * @param request - The set request
   * @param request.name - Entry name (for key-value storage)
   * @param request.idx - Entry index (for indexed storage)
   * @param request.value - The value to store
   * @param request.contentType - MIME type (default: 'text/plain')
   * @param request.encoding - Encoding: 'utf-8', 'base64', or 'hex' (default: 'utf-8')
   * @param request.visibility - Visibility: 'private', 'workspace', or 'public' (default: 'private')
   * @param request.ttlSeconds - Time-to-live in seconds (max: 1 year)
   * @param request.createdByTool - Name of the tool that created this entry
   * @param request.createdByModel - Name of the AI model that created this entry
   * @returns The created/updated clipboard entry
   * @throws {PluggedInError} If neither name nor idx is provided
   * @throws {ValidationError} If ttlSeconds or value size is invalid
   *
   * @example
   * ```typescript
   * // Set a named entry with JSON
   * await client.clipboard.set({
   *   name: 'user_data',
   *   value: JSON.stringify({ name: 'John', age: 30 }),
   *   contentType: 'application/json',
   *   ttlSeconds: 3600 // expires in 1 hour
   * });
   * ```
   */
  async set(request: ClipboardSetRequest): Promise<ClipboardEntry> {
    if (request.name === undefined && request.idx === undefined) {
      throw new PluggedInError('Either name or idx must be provided');
    }

    // Validate inputs
    this.validateTtlSeconds(request.ttlSeconds);
    this.validateValueSize(request.value);

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
   * Push a new entry to the indexed clipboard (auto-increment index).
   *
   * This appends a new entry with an auto-generated index, useful for
   * stack-like or queue-like operations.
   *
   * @param request - The push request
   * @param request.value - The value to store
   * @param request.contentType - MIME type (default: 'text/plain')
   * @param request.encoding - Encoding: 'utf-8', 'base64', or 'hex' (default: 'utf-8')
   * @param request.visibility - Visibility level (default: 'private')
   * @param request.ttlSeconds - Time-to-live in seconds (max: 1 year)
   * @param request.createdByTool - Name of the tool that created this entry
   * @param request.createdByModel - Name of the AI model that created this entry
   * @returns The created clipboard entry with its assigned index
   * @throws {ValidationError} If ttlSeconds or value size is invalid
   *
   * @example
   * ```typescript
   * // Push workflow steps
   * await client.clipboard.push({ value: 'Step 1: Initialize' });
   * await client.clipboard.push({ value: 'Step 2: Process' });
   * await client.clipboard.push({ value: 'Step 3: Complete' });
   * ```
   */
  async push(request: ClipboardPushRequest): Promise<ClipboardEntry> {
    // Validate inputs
    this.validateTtlSeconds(request.ttlSeconds);
    this.validateValueSize(request.value);

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
   * Pop the most recent entry from the indexed clipboard (LIFO).
   *
   * Removes and returns the entry with the highest index. This is useful
   * for stack-like operations where you want to process items in reverse order.
   *
   * Note: This method returns null for an empty clipboard, unlike `get()` which
   * throws NotFoundError. This difference is intentional: `get()` expects the
   * item to exist, while `pop()` expects the clipboard might be empty.
   *
   * @returns The popped entry, or null if the clipboard is empty
   *
   * @example
   * ```typescript
   * // Process stack until empty
   * let entry = await client.clipboard.pop();
   * while (entry !== null) {
   *   console.log('Processing:', entry.value);
   *   entry = await client.clipboard.pop();
   * }
   * ```
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
   * Delete clipboard entries.
   *
   * Exactly one deletion method must be specified: name, idx, or clearAll.
   *
   * @param options - Deletion options
   * @param options.name - Delete entry by name
   * @param options.idx - Delete entry by index
   * @param options.clearAll - Delete all entries (use with caution)
   * @returns Number of entries deleted
   * @throws {PluggedInError} If no deletion method is specified
   * @throws {ValidationError} If multiple deletion methods are specified
   *
   * @example
   * ```typescript
   * // Delete by name
   * await client.clipboard.delete({ name: 'old_config' });
   *
   * // Delete by index
   * await client.clipboard.delete({ idx: 0 });
   *
   * // Clear all (use with caution!)
   * const deleted = await client.clipboard.delete({ clearAll: true });
   * console.log(`Deleted ${deleted} entries`);
   * ```
   */
  async delete(options: ClipboardDeleteRequest): Promise<number> {
    const hasName = options.name !== undefined;
    const hasIdx = options.idx !== undefined;
    const hasClearAll = options.clearAll === true;
    const methodCount = [hasName, hasIdx, hasClearAll].filter(Boolean).length;

    if (methodCount === 0) {
      throw new PluggedInError('Either name, idx, or clearAll must be provided');
    }
    if (methodCount > 1) {
      throw new ValidationError('Only one deletion method can be specified (name, idx, or clearAll)');
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
   * Clear all clipboard entries.
   * Convenience method for deleting all entries at once.
   *
   * @returns Number of entries deleted
   *
   * @example
   * ```typescript
   * const count = await client.clipboard.clearAll();
   * console.log(`Cleared ${count} entries`);
   * ```
   */
  async clearAll(): Promise<number> {
    return this.delete({ clearAll: true });
  }

  /**
   * Transform API response to ClipboardEntry type.
   * Handles date parsing and default values.
   * @internal
   */
  private transformEntry(data: ClipboardApiEntry): ClipboardEntry {
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
