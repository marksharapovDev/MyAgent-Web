CREATE TABLE conversation_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects (id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks (id) ON DELETE SET NULL,
  role        TEXT NOT NULL
                CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'telegram'
                CHECK (source IN ('telegram', 'desktop', 'api')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_history_project_id  ON conversation_history (project_id);
CREATE INDEX idx_conversation_history_task_id     ON conversation_history (task_id);
CREATE INDEX idx_conversation_history_created_at  ON conversation_history (project_id, created_at DESC);
