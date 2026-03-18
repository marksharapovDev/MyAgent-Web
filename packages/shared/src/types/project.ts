export type ProjectStatus = 'active' | 'paused' | 'completed';

export interface ProjectStack {
  framework?: string;
  css?: string;
  language?: string;
  [key: string]: unknown;
}

export interface VpsConfig {
  host?: string;
  user?: string;
  deployPath?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  stack: ProjectStack;
  repoUrl?: string;
  vercelId?: string;
  vpsConfig: VpsConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectConfig {
  stack: ProjectStack;
  repoUrl?: string;
  vercelId?: string;
  vpsConfig?: VpsConfig;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  config?: ProjectConfig;
}
