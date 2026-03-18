import jwt from 'jsonwebtoken';
import { createLogger } from '@my-agent/shared';

const log = createLogger('api-client');

export interface ApiTask {
  taskId: string;
  type: string;
  status: string;
  progress: unknown;
  result: unknown;
  failedReason: string | null;
}

export interface ApiProject {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ApiPlan {
  id: string;
  projectId: string;
  status: string;
  phases: unknown[];
}

function makeServiceToken(secret: string): string {
  return jwt.sign({ userId: 'telegram-bot' }, secret, { expiresIn: '30d' });
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = process.env['SERVER_URL'] ?? 'http://localhost:3001';

    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error('JWT_SECRET is required');

    this.token = makeServiceToken(secret);
    log.info('ApiClient initialised', { baseUrl: this.baseUrl });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text();
      log.error('API request failed', { method, path, status: response.status, body: text });
      throw new Error(`API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async createTask(input: {
    projectId: string;
    type: string;
    input: Record<string, unknown>;
    source?: string;
  }): Promise<{ taskId: string; status: string }> {
    return this.request('POST', '/api/tasks', { ...input, source: input.source ?? 'telegram' });
  }

  async getTask(taskId: string): Promise<ApiTask> {
    return this.request('GET', `/api/tasks/${taskId}`);
  }

  async listTasks(projectId?: string): Promise<ApiTask[]> {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return this.request('GET', `/api/tasks${qs}`);
  }

  async listProjects(): Promise<ApiProject[]> {
    return this.request('GET', '/api/projects');
  }

  async getProject(id: string): Promise<ApiProject> {
    return this.request('GET', `/api/projects/${id}`);
  }

  async createProject(input: { name: string; slug: string }): Promise<ApiProject> {
    return this.request('POST', '/api/projects', input);
  }

  async getActivePlan(projectId: string): Promise<ApiPlan | null> {
    try {
      return await this.request('GET', `/api/plans?project_id=${projectId}`);
    } catch {
      return null;
    }
  }
}
