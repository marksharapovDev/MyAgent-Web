import type { TaskType } from './task.js';

export type PlanTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export type PlanMode = 'autopilot' | 'detail';

export type PlanStatus = 'active' | 'completed' | 'archived';

export type PhaseType = 'design' | 'code' | 'review' | 'deploy';

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: PlanTaskStatus;
  estimatedMinutes?: number;
  dependsOn: string[];
  output?: Record<string, unknown>;
}

export interface Phase {
  id: string;
  title: string;
  type: PhaseType;
  tasks: PlanTask[];
  checkpoint: boolean;
}

export interface ProjectPlan {
  id: string;
  projectId: string;
  version: number;
  status: PlanStatus;
  mode: PlanMode;
  brief: string;
  phases: Phase[];
  currentPhaseIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanInput {
  projectId: string;
  brief: string;
  mode?: PlanMode;
  phases: Omit<Phase, 'id'>[];
}
