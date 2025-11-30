import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import {
  ClientConfig,
  PluggedInError,
  RateLimitError,
  AuthenticationError,
  NotFoundError
} from './types';
import { ClipboardService } from './services/clipboard';
import { DocumentService } from './services/documents';
import { RagService } from './services/rag';
import { UploadService } from './services/uploads';
import { AgentService } from './services/agents';

const DEFAULT_BASE_URL = 'https://plugged.in';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;

export class PluggedInClient {
  private axios: AxiosInstance;
  private config: Required<ClientConfig>;

  public readonly clipboard: ClipboardService;
  public readonly documents: DocumentService;
  public readonly rag: RagService;
  public readonly uploads: UploadService;
  public readonly agents: AgentService;

  constructor(config: ClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      debug: config.debug || false,
    };

    this.axios = this.createAxiosInstance();

    // Initialize services
    this.clipboard = new ClipboardService(this.axios, this.config);
    this.documents = new DocumentService(this.axios, this.config);
    this.rag = new RagService(this.axios, this.config);
    this.uploads = new UploadService(this.axios, this.config);
    this.agents = new AgentService(this.axios, this.config);
  }

  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for debugging
    if (this.config.debug) {
      instance.interceptors.request.use((config) => {
        console.log(`[PluggedIn SDK] ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data) {
          console.log('[PluggedIn SDK] Request data:', config.data);
        }
        return config;
      });
    }

    // Response interceptor for error handling
    instance.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          console.log(`[PluggedIn SDK] Response:`, response.status, response.data);
        }
        return response;
      },
      async (error: AxiosError) => {
        if (this.config.debug) {
          console.error('[PluggedIn SDK] Error:', error.message);
        }

        // Handle specific error cases
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as any;

          switch (status) {
            case 401:
              throw new AuthenticationError(data?.error || 'Invalid API key');

            case 404:
              throw new NotFoundError(data?.error || 'Resource not found');

            case 429:
              const retryAfter = error.response.headers['retry-after'];
              throw new RateLimitError(
                data?.error || 'Rate limit exceeded',
                retryAfter ? parseInt(retryAfter) : undefined
              );

            default:
              throw new PluggedInError(
                data?.error || `Request failed with status ${status}`,
                status,
                data?.details
              );
          }
        } else if (error.request) {
          // Request was made but no response received
          throw new PluggedInError('No response from server - check network connection');
        } else {
          // Something else happened
          throw new PluggedInError(error.message || 'Request configuration error');
        }
      }
    );

    // Add retry logic for rate limiting and transient errors
    instance.interceptors.response.use(
      undefined,
      async (error: AxiosError) => {
        const config = error.config as AxiosRequestConfig & { __retryCount?: number };

        if (!config || !this.shouldRetry(error) || (config.__retryCount || 0) >= this.config.maxRetries) {
          return Promise.reject(error);
        }

        config.__retryCount = (config.__retryCount || 0) + 1;

        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(config.__retryCount, error);

        if (this.config.debug) {
          console.log(`[PluggedIn SDK] Retrying request (attempt ${config.__retryCount}/${this.config.maxRetries}) after ${delay}ms`);
        }

        await this.sleep(delay);
        return instance(config);
      }
    );

    return instance;
  }

  private shouldRetry(error: AxiosError): boolean {
    // Don't retry if no response (network errors)
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Retry on rate limiting, server errors, and gateway errors
    return status === 429 || status >= 500;
  }

  private calculateRetryDelay(retryCount: number, error: AxiosError): number {
    // Check for Retry-After header
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000; // Convert to milliseconds
      }
    }

    // Exponential backoff: 1s, 2s, 4s, etc.
    return Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update the API key
   */
  public setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.axios.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<Required<ClientConfig>> {
    return { ...this.config };
  }
}