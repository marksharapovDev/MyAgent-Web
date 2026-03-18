CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  plan_task_id  TEXT,
  type          TEXT NOT NULL
                  CHECK (type IN ('design', 'code', 'deploy', 'general')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'review', 'done', 'failed')),
  priority      INT NOT NULL DEFAULT 0,
  input         JSONB NOT NULL,
  output        JSONB,
  source        TEXT NOT NULL DEFAULT 'telegram'
                  CHECK (source IN ('telegram', 'desktop', 'api')),
  claude_model  TEXT NOT NULL DEFAULT 'sonnet'
                  CHECK (claude_model IN ('sonnet', 'opus', 'haiku')),
  tokens_used   INT NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_tasks_project_id ON tasks (project_id);
CREATE INDEX idx_tasks_status     ON tasks (status);
CREATE INDEX idx_tasks_type       ON tasks (type);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);
