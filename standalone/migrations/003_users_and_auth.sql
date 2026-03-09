CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_name VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  route VARCHAR(255) NOT NULL,
  requires_secret_key BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_applications (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, application_id)
);

CREATE INDEX IF NOT EXISTS idx_user_applications_user ON user_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_applications_app ON user_applications(application_id);

CREATE TABLE IF NOT EXISTS ai_engineering_saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_url VARCHAR(2000),
  venue_name VARCHAR(500),
  venue_address VARCHAR(1000),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  category VARCHAR(100),
  is_free BOOLEAN,
  confidence_score NUMERIC(3,2),
  match_explanation TEXT,
  status VARCHAR(20) DEFAULT 'interested',
  notes TEXT,
  enriched_at TIMESTAMPTZ,
  enrichment_data JSONB,
  source_thread_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_events_user ON ai_engineering_saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_start ON ai_engineering_saved_events(start_time);
CREATE INDEX IF NOT EXISTS idx_saved_events_status ON ai_engineering_saved_events(status);

DROP TRIGGER IF EXISTS update_saved_events_updated_at ON ai_engineering_saved_events;
CREATE TRIGGER update_saved_events_updated_at
  BEFORE UPDATE ON ai_engineering_saved_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO applications (slug, name, description, route, requires_secret_key) VALUES
  ('ai-engineering', 'AI Engineering', 'AI-powered community event discovery', '/ai-engineering', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Default user for AUTH_DISABLED mode (password field unused)
INSERT INTO users (id, user_name, email, name, password) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo', 'demo@localhost', 'Demo User', 'disabled')
ON CONFLICT (id) DO NOTHING;

-- Grant default user ai-engineering access
INSERT INTO user_applications (user_id, application_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM applications WHERE slug = 'ai-engineering'
ON CONFLICT DO NOTHING;
