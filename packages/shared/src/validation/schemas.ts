import { z } from 'zod';

// ── Task ─────────────────────────────────────────────────────────────────────

export const TaskTypeSchema = z.enum(['design', 'code', 'deploy', 'general']);

export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'review',
  'done',
  'failed',
]);

export const TaskSourceSchema = z.enum(['telegram', 'desktop', 'api']);

export const ClaudeModelSchema = z.enum(['sonnet', 'opus', 'haiku']);

export const CreateTaskInputSchema = z.object({
  projectId: z.string().uuid(),
  planTaskId: z.string().optional(),
  type: TaskTypeSchema,
  priority: z.number().int().min(0).max(100).default(0),
  input: z.record(z.unknown()),
  source: TaskSourceSchema.default('telegram'),
  claudeModel: ClaudeModelSchema.default('sonnet'),
});

// ── Project ───────────────────────────────────────────────────────────────────

export const ProjectStatusSchema = z.enum(['active', 'paused', 'completed']);

export const ProjectStackSchema = z.record(z.unknown());

export const VpsConfigSchema = z.record(z.unknown());

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'),
  config: z
    .object({
      stack: ProjectStackSchema.default({}),
      repoUrl: z.string().url().optional(),
      vercelId: z.string().optional(),
      vpsConfig: VpsConfigSchema.default({}),
    })
    .optional(),
});

// ── Plan ─────────────────────────────────────────────────────────────────────

export const PlanModeSchema = z.enum(['autopilot', 'detail']);

export const PlanTaskStatusSchema = z.enum([
  'pending',
  'running',
  'done',
  'failed',
  'skipped',
]);

export const PlanTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  type: TaskTypeSchema,
  status: PlanTaskStatusSchema.default('pending'),
  estimatedMinutes: z.number().int().positive().optional(),
  dependsOn: z.array(z.string()).default([]),
  output: z.record(z.unknown()).optional(),
});

export const PhaseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: z.enum(['design', 'code', 'review', 'deploy']),
  tasks: z.array(PlanTaskSchema),
  checkpoint: z.boolean().default(false),
});

// ── Design ────────────────────────────────────────────────────────────────────

export const DesignRequirementsSchema = z.object({
  businessType: z.string().min(1),
  colorScheme: z.string().optional(),
  style: z.string().optional(),
  sections: z.array(z.string()).min(1),
  references: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const DesignFeedbackSchema = z.object({
  designVersionId: z.string().uuid(),
  feedback: z.string().min(1),
  approved: z.boolean(),
});
