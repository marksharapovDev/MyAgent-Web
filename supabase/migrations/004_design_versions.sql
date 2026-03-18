CREATE TABLE design_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version        INT NOT NULL,
  variant        INT NOT NULL DEFAULT 1
                   CHECK (variant BETWEEN 1 AND 3),
  html_code      TEXT NOT NULL,
  screenshot_url TEXT,
  feedback       TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, version, variant)
);

CREATE INDEX idx_design_versions_task_id    ON design_versions (task_id);
CREATE INDEX idx_design_versions_project_id ON design_versions (project_id);
CREATE INDEX idx_design_versions_status     ON design_versions (project_id, status);
