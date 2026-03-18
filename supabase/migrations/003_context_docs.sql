-- Enable pgvector for semantic search (requires Supabase pgvector extension)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE context_docs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL
                CHECK (doc_type IN ('brief', 'styleguide', 'architecture', 'notes')),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536),
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_context_docs_project_id ON context_docs (project_id);
CREATE INDEX idx_context_docs_doc_type   ON context_docs (project_id, doc_type);

-- IVFFlat index for approximate nearest-neighbour search (cosine distance)
-- Build after loading data: CREATE INDEX ... ON context_docs USING ivfflat (embedding vector_cosine_ops);
-- Placeholder created as a regular index so migrations don't fail on empty tables:
CREATE INDEX idx_context_docs_embedding ON context_docs USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE TRIGGER trg_context_docs_updated_at
  BEFORE UPDATE ON context_docs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
