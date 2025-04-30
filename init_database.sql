CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE data (
    id SERIAL PRIMARY KEY,
    content TEXT,
    category TEXT,
    embedding vector(768)  -- 768-dimensional embedding (MPNet-compatible)
);

-- Optional: Create ivfflat index for vector search (faster queries after ANALYZE)
CREATE INDEX data_embedding_idx ON data USING ivfflat (embedding vector_cosine_ops);

-- Analyze for performance
ANALYZE data;

