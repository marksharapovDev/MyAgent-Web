CREATE TABLE project_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  version     INT NOT NULL DEFAULT 1,
  plan        JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'archived')),
  mode        TEXT NOT NULL DEFAULT 'autopilot'
                CHECK (mode IN ('autopilot', 'detail')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, version)
);

CREATE INDEX idx_project_plans_project_id ON project_plans (project_id);
CREATE INDEX idx_project_plans_status     ON project_plans (project_id, status);

CREATE TRIGGER trg_project_plans_updated_at
  BEFORE UPDATE ON project_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
