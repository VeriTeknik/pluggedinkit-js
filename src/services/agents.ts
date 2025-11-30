import { AxiosInstance } from 'axios';
import type { ClientConfig } from '../types';

export interface Agent {
  uuid: string;
  name: string;
  dns_name: string;
  state: 'NEW' | 'PROVISIONED' | 'ACTIVE' | 'DRAINING' | 'TERMINATED' | 'KILLED';
  kubernetes_namespace?: string;
  kubernetes_deployment?: string;
  created_at: string;
  provisioned_at?: string;
  activated_at?: string;
  terminated_at?: string;
  last_heartbeat_at?: string;
  metadata?: any;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  image?: string;
  resources?: {
    cpu_request?: string;
    memory_request?: string;
    cpu_limit?: string;
    memory_limit?: string;
  };
}

export interface CreateAgentResponse {
  agent: Agent;
  deployment: {
    success: boolean;
    message: string;
  };
}

export interface AgentDetails {
  agent: Agent;
  recentHeartbeats: Array<{
    mode: string;
    uptime_seconds: number;
    timestamp: string;
  }>;
  recentMetrics: Array<{
    cpu_percent: number;
    memory_mb: number;
    requests_handled: number;
    timestamp: string;
  }>;
  lifecycleEvents: Array<{
    event_type: string;
    from_state: string | null;
    to_state: string;
    timestamp: string;
    metadata?: any;
  }>;
  kubernetesStatus?: any;
}

export interface ExportAgentRequest {
  include_telemetry?: boolean;
  telemetry_limit?: number;
}

export class AgentService {
  constructor(
    private axios: AxiosInstance,
    private config: Required<ClientConfig>
  ) {}

  /**
   * List all PAP agents
   */
  async list(): Promise<Agent[]> {
    const response = await this.axios.get<Agent[]>('/api/agents');
    return response.data;
  }

  /**
   * Create a new PAP agent
   */
  async create(request: CreateAgentRequest): Promise<CreateAgentResponse> {
    const response = await this.axios.post<CreateAgentResponse>(
      '/api/agents',
      request
    );
    return response.data;
  }

  /**
   * Get details for a specific agent
   */
  async get(agentId: string): Promise<AgentDetails> {
    const response = await this.axios.get<AgentDetails>(`/api/agents/${agentId}`);
    return response.data;
  }

  /**
   * Delete an agent (terminates deployment)
   */
  async delete(agentId: string): Promise<{ message: string; kubernetes: { success: boolean; message: string } }> {
    const response = await this.axios.delete(`/api/agents/${agentId}`);
    return response.data;
  }

  /**
   * Export agent data including telemetry
   */
  async export(agentId: string, options?: ExportAgentRequest): Promise<any> {
    const response = await this.axios.post(
      `/api/agents/${agentId}/export`,
      options || {}
    );
    return response.data;
  }

  /**
   * Submit a heartbeat for an agent
   */
  async heartbeat(
    agentId: string,
    heartbeat: {
      mode: 'EMERGENCY' | 'IDLE' | 'SLEEP';
      uptime_seconds: number;
    }
  ): Promise<{ message: string }> {
    const response = await this.axios.post(
      `/api/agents/${agentId}/heartbeat`,
      heartbeat
    );
    return response.data;
  }

  /**
   * Submit metrics for an agent
   */
  async metrics(
    agentId: string,
    metrics: {
      cpu_percent: number;
      memory_mb: number;
      requests_handled: number;
      custom_metrics?: Record<string, any>;
    }
  ): Promise<{ message: string }> {
    const response = await this.axios.post(
      `/api/agents/${agentId}/metrics`,
      metrics
    );
    return response.data;
  }
}
