CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS filtering_heuristics (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS filtering_heuristics_embedding_idx
  ON filtering_heuristics USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_filtering_heuristics_category
  ON filtering_heuristics (category);
