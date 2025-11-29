import axios from 'axios';
import { ClipboardService } from '../src/services/clipboard';
import {
  ClipboardApiEntry,
  ClipboardResponse,
  ClipboardDeleteResponse,
  ClipboardListApiResponse,
  PluggedInError,
  NotFoundError,
  ValidationError,
  MAX_CLIPBOARD_TTL_SECONDS,
  MAX_CLIPBOARD_VALUE_SIZE,
  DEFAULT_CLIPBOARD_LIST_LIMIT,
  DEFAULT_CLIPBOARD_LIST_OFFSET
} from '../src/types';

// Mock axios
jest.mock('axios');

describe('ClipboardService', () => {
  let service: ClipboardService;
  let mockAxios: jest.Mocked<typeof axios>;

  const mockConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.com',
    timeout: 30000,
    maxRetries: 3,
    debug: false
  };

  // Use ClipboardApiEntry (with string dates) for API mock responses
  const mockApiEntry: ClipboardApiEntry = {
    uuid: 'test-uuid-1234',
    name: 'test_entry',
    idx: null,
    value: 'test value',
    contentType: 'text/plain',
    encoding: 'utf-8',
    sizeBytes: 10,
    visibility: 'private',
    createdByTool: null,
    createdByModel: null,
    source: 'sdk',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    expiresAt: null
  };

  beforeEach(() => {
    mockAxios = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      put: jest.fn(),
      patch: jest.fn()
    } as unknown as jest.Mocked<typeof axios>;

    service = new ClipboardService(mockAxios as any, mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list()', () => {
    it('should list clipboard entries without filters', async () => {
      const mockResponse: ClipboardListApiResponse = {
        entries: [mockApiEntry],
        total: 1,
        limit: 50,
        offset: 0
      };

      mockAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await service.list();

      expect(mockAxios.get).toHaveBeenCalledWith('/api/clipboard', { params: expect.any(URLSearchParams) });
      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should list clipboard entries with filters', async () => {
      const mockResponse: ClipboardListApiResponse = {
        entries: [],
        total: 0,
        limit: 10,
        offset: 5
      };

      mockAxios.get.mockResolvedValue({ data: mockResponse });

      await service.list({ contentType: 'application/json', limit: 10, offset: 5 });

      expect(mockAxios.get).toHaveBeenCalled();
      const callArgs = mockAxios.get.mock.calls[0];
      expect(callArgs).toBeDefined();
      if (!callArgs) throw new Error('Expected call args');
      const params = callArgs[1]?.params as URLSearchParams;
      expect(params.get('contentType')).toBe('application/json');
      expect(params.get('limit')).toBe('10');
      expect(params.get('offset')).toBe('5');
    });

    it('should use default values for missing response fields', async () => {
      const mockResponse: ClipboardListApiResponse = {};

      mockAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await service.list();

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.limit).toBe(DEFAULT_CLIPBOARD_LIST_LIMIT);
      expect(result.offset).toBe(DEFAULT_CLIPBOARD_LIST_OFFSET);
    });

    it('should preserve 0 values in response (not replace with defaults)', async () => {
      const mockResponse: ClipboardListApiResponse = {
        entries: [],
        total: 0,
        limit: 0,
        offset: 0
      };

      mockAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await service.list();

      // limit: 0 should NOT be replaced with default
      expect(result.limit).toBe(0);
      expect(result.offset).toBe(0);
    });
  });

  describe('get()', () => {
    it('should get entry by name', async () => {
      mockAxios.get.mockResolvedValue({
        data: { entry: mockApiEntry, success: true }
      });

      const result = await service.get({ name: 'test_entry' });

      expect(result.name).toBe('test_entry');
      expect(result.value).toBe('test value');
    });

    it('should get entry by index', async () => {
      const indexedEntry = { ...mockApiEntry, name: null, idx: 0 };
      mockAxios.get.mockResolvedValue({
        data: { entry: indexedEntry, success: true }
      });

      const result = await service.get({ idx: 0 });

      expect(result.idx).toBe(0);
    });

    it('should throw PluggedInError when neither name nor idx provided', async () => {
      await expect(service.get({})).rejects.toThrow(PluggedInError);
      await expect(service.get({})).rejects.toThrow('Either name or idx must be provided');
    });

    it('should throw NotFoundError when entry not found', async () => {
      mockAxios.get.mockResolvedValue({
        data: { entry: null, success: true }
      });

      await expect(service.get({ name: 'nonexistent' })).rejects.toThrow(NotFoundError);
      await expect(service.get({ name: 'nonexistent' })).rejects.toThrow('Clipboard entry not found');
    });
  });

  describe('getByName()', () => {
    it('should call get with name parameter', async () => {
      mockAxios.get.mockResolvedValue({
        data: { entry: mockApiEntry, success: true }
      });

      const result = await service.getByName('test_entry');

      expect(result.name).toBe('test_entry');
    });
  });

  describe('getByIndex()', () => {
    it('should call get with idx parameter', async () => {
      const indexedEntry = { ...mockApiEntry, name: null, idx: 5 };
      mockAxios.get.mockResolvedValue({
        data: { entry: indexedEntry, success: true }
      });

      const result = await service.getByIndex(5);

      expect(result.idx).toBe(5);
    });
  });

  describe('set()', () => {
    it('should set entry with name', async () => {
      const response: ClipboardResponse = {
        success: true,
        entry: mockApiEntry
      };

      mockAxios.post.mockResolvedValue({ data: response });

      const result = await service.set({ name: 'test_entry', value: 'test value' });

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/clipboard',
        expect.objectContaining({ name: 'test_entry', value: 'test value', source: 'sdk' })
      );
      expect(result.name).toBe('test_entry');
    });

    it('should throw PluggedInError when neither name nor idx provided', async () => {
      await expect(service.set({ value: 'test' })).rejects.toThrow(PluggedInError);
    });

    it('should throw ValidationError for negative TTL', async () => {
      await expect(
        service.set({ name: 'test', value: 'test', ttlSeconds: -1 })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.set({ name: 'test', value: 'test', ttlSeconds: -1 })
      ).rejects.toThrow('ttlSeconds must be a positive number');
    });

    it('should throw ValidationError for TTL exceeding maximum', async () => {
      await expect(
        service.set({ name: 'test', value: 'test', ttlSeconds: MAX_CLIPBOARD_TTL_SECONDS + 1 })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.set({ name: 'test', value: 'test', ttlSeconds: MAX_CLIPBOARD_TTL_SECONDS + 1 })
      ).rejects.toThrow(`ttlSeconds must be at most ${MAX_CLIPBOARD_TTL_SECONDS}`);
    });

    it('should throw ValidationError for value exceeding maximum size', async () => {
      const largeValue = 'x'.repeat(MAX_CLIPBOARD_VALUE_SIZE + 1);
      await expect(
        service.set({ name: 'test', value: largeValue })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.set({ name: 'test', value: largeValue })
      ).rejects.toThrow('exceeds maximum allowed size');
    });

    it('should throw PluggedInError on API failure', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'Server error' }
      });

      await expect(
        service.set({ name: 'test', value: 'test' })
      ).rejects.toThrow(PluggedInError);
    });
  });

  describe('push()', () => {
    it('should push entry and return with assigned index', async () => {
      const pushedEntry: ClipboardApiEntry = { ...mockApiEntry, name: null, idx: 0 };
      const response: ClipboardResponse = {
        success: true,
        entry: pushedEntry
      };

      mockAxios.post.mockResolvedValue({ data: response });

      const result = await service.push({ value: 'pushed value' });

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/clipboard/push',
        expect.objectContaining({ value: 'pushed value', source: 'sdk' })
      );
    });

    it('should validate TTL and value size', async () => {
      await expect(
        service.push({ value: 'test', ttlSeconds: -1 })
      ).rejects.toThrow(ValidationError);

      const largeValue = 'x'.repeat(MAX_CLIPBOARD_VALUE_SIZE + 1);
      await expect(
        service.push({ value: largeValue })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('pop()', () => {
    it('should pop and return entry', async () => {
      const poppedEntry: ClipboardApiEntry = { ...mockApiEntry, name: null, idx: 0 };
      const response: ClipboardResponse = {
        success: true,
        entry: poppedEntry
      };

      mockAxios.post.mockResolvedValue({ data: response });

      const result = await service.pop();

      expect(result).not.toBeNull();
      expect(result?.value).toBe('test value');
    });

    it('should return null when clipboard is empty (success with no entry)', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: true, entry: null }
      });

      const result = await service.pop();

      expect(result).toBeNull();
    });

    it('should return null when error message indicates empty clipboard', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'Clipboard is empty' }
      });

      const result = await service.pop();

      expect(result).toBeNull();
    });

    it('should return null when error message indicates no indexed entries', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'No indexed entries found' }
      });

      const result = await service.pop();

      expect(result).toBeNull();
    });

    it('should return null on NotFoundError', async () => {
      mockAxios.post.mockRejectedValue(new NotFoundError());

      const result = await service.pop();

      expect(result).toBeNull();
    });

    it('should throw PluggedInError on real API errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'Database connection failed' }
      });

      await expect(service.pop()).rejects.toThrow(PluggedInError);
    });

    it('should rethrow non-NotFoundError errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(service.pop()).rejects.toThrow('Network error');
    });
  });

  describe('delete()', () => {
    it('should delete by name', async () => {
      const response: ClipboardDeleteResponse = { success: true, deleted: 1 };
      mockAxios.delete.mockResolvedValue({ data: response });

      const result = await service.delete({ name: 'test_entry' });

      expect(result).toBe(1);
      expect(mockAxios.delete).toHaveBeenCalledWith('/api/clipboard', {
        data: { name: 'test_entry' }
      });
    });

    it('should delete by index', async () => {
      const response: ClipboardDeleteResponse = { success: true, deleted: 1 };
      mockAxios.delete.mockResolvedValue({ data: response });

      const result = await service.delete({ idx: 0 });

      expect(result).toBe(1);
    });

    it('should clear all', async () => {
      const response: ClipboardDeleteResponse = { success: true, deleted: 5 };
      mockAxios.delete.mockResolvedValue({ data: response });

      const result = await service.delete({ clearAll: true });

      expect(result).toBe(5);
    });

    it('should throw PluggedInError when no deletion method specified', async () => {
      await expect(service.delete({})).rejects.toThrow(PluggedInError);
      await expect(service.delete({})).rejects.toThrow('Either name, idx, or clearAll must be provided');
    });

    it('should throw ValidationError when multiple deletion methods specified', async () => {
      await expect(
        service.delete({ name: 'test', idx: 0 })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.delete({ name: 'test', idx: 0 })
      ).rejects.toThrow('Only one deletion method can be specified');
    });

    it('should throw ValidationError when name and clearAll specified', async () => {
      await expect(
        service.delete({ name: 'test', clearAll: true })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when idx and clearAll specified', async () => {
      await expect(
        service.delete({ idx: 0, clearAll: true })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when all three methods specified', async () => {
      await expect(
        service.delete({ name: 'test', idx: 0, clearAll: true })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw PluggedInError on API failure', async () => {
      mockAxios.delete.mockResolvedValue({
        data: { success: false, error: 'Delete failed' }
      });

      await expect(service.delete({ name: 'test' })).rejects.toThrow(PluggedInError);
    });
  });

  describe('clearAll()', () => {
    it('should call delete with clearAll: true', async () => {
      const response: ClipboardDeleteResponse = { success: true, deleted: 10 };
      mockAxios.delete.mockResolvedValue({ data: response });

      const result = await service.clearAll();

      expect(result).toBe(10);
      expect(mockAxios.delete).toHaveBeenCalledWith('/api/clipboard', {
        data: { clearAll: true }
      });
    });
  });

  describe('transformEntry()', () => {
    it('should parse dates correctly', async () => {
      mockAxios.get.mockResolvedValue({
        data: { entry: mockApiEntry, success: true }
      });

      const result = await service.get({ name: 'test' });

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle null expiresAt', async () => {
      mockAxios.get.mockResolvedValue({
        data: { entry: { ...mockApiEntry, expiresAt: null }, success: true }
      });

      const result = await service.get({ name: 'test' });

      expect(result.expiresAt).toBeNull();
    });

    it('should parse expiresAt when present', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          entry: { ...mockApiEntry, expiresAt: '2024-12-31T23:59:59.000Z' },
          success: true
        }
      });

      const result = await service.get({ name: 'test' });

      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should default source to ui for backward compatibility', async () => {
      const entryWithoutSource = { ...mockApiEntry };
      delete (entryWithoutSource as any).source;

      mockAxios.get.mockResolvedValue({
        data: { entry: entryWithoutSource, success: true }
      });

      const result = await service.get({ name: 'test' });

      expect(result.source).toBe('ui');
    });
  });

  describe('isEmptyClipboardResponse()', () => {
    // These tests are indirect since the method is private
    // We test through pop() which uses this method

    it('should detect empty via success with no entry', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: true, entry: undefined }
      });

      const result = await service.pop();
      expect(result).toBeNull();
    });

    it('should detect empty via "empty" error message', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'The clipboard is Empty' }
      });

      const result = await service.pop();
      expect(result).toBeNull();
    });

    it('should detect empty via "no indexed entries" error message', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'No indexed entries available' }
      });

      const result = await service.pop();
      expect(result).toBeNull();
    });

    it('should not false-positive on unrelated errors', async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: false, error: 'Authentication failed' }
      });

      await expect(service.pop()).rejects.toThrow('Authentication failed');
    });
  });
});

describe('Type Exports', () => {
  it('should export ValidationError', () => {
    const error = new ValidationError('test');
    expect(error).toBeInstanceOf(PluggedInError);
    expect(error.name).toBe('ValidationError');
    expect(error.status).toBe(400);
  });

  it('should export clipboard constants', () => {
    expect(MAX_CLIPBOARD_TTL_SECONDS).toBe(31536000);
    expect(MAX_CLIPBOARD_VALUE_SIZE).toBe(2 * 1024 * 1024);
    expect(DEFAULT_CLIPBOARD_LIST_LIMIT).toBe(50);
    expect(DEFAULT_CLIPBOARD_LIST_OFFSET).toBe(0);
  });
});
