ALTER TABLE filtering_heuristics ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE filtering_heuristics
SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''));

CREATE INDEX IF NOT EXISTS idx_filtering_heuristics_fts
  ON filtering_heuristics USING gin(search_vector);

CREATE OR REPLACE FUNCTION filtering_heuristics_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_filtering_heuristics_fts ON filtering_heuristics;
CREATE TRIGGER trg_filtering_heuristics_fts
  BEFORE INSERT OR UPDATE ON filtering_heuristics
  FOR EACH ROW EXECUTE FUNCTION filtering_heuristics_fts_trigger();
