-- =====================================================
-- FUSION WORKFLOW DATABASE SCHEMA
-- =====================================================
-- Purpose: Complete database schema for auto-fusion workflow with persistence
-- Tables: parsed_documents, fusion_sessions, fusion_suggestions
-- Note: fused_checklists table already exists (see supabase_migration.sql)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE 1: parsed_documents
-- =====================================================
-- Stores parsed PDF checklists with full structure from Unstruct API
-- Enables caching: Same PDF hash = reuse parsing (no redundant API calls)

CREATE TABLE IF NOT EXISTS parsed_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- File identification
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash for deduplication
  file_size_bytes BIGINT,

  -- Document metadata (from Unstruct extraction)
  document_metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: { "title": "ProCert 2025", "version": "2025", "publisher": "ProCert", "date": "27.01.2025" }

  -- Full parsed structure (nested sections → items)
  sections JSONB NOT NULL,
  -- Example: [{ "letter": "A", "title": "Généralités", "items": [...] }]

  -- Statistics
  total_items INTEGER DEFAULT 0,
  total_sections INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parsed_documents_hash
  ON parsed_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_parsed_documents_created
  ON parsed_documents(created_at DESC);

-- Comments
COMMENT ON TABLE parsed_documents IS 'Cached parsed PDFs with full Unstruct API structure';
COMMENT ON COLUMN parsed_documents.file_hash IS 'SHA-256 hash for deduplication - same file = reuse parsing';
COMMENT ON COLUMN parsed_documents.sections IS 'Full nested structure: [{ letter, title, items: [] }]';
COMMENT ON COLUMN parsed_documents.document_metadata IS 'Extracted metadata: title, version, publisher, date';

-- =====================================================
-- TABLE 2: fusion_sessions
-- =====================================================
-- Groups related fusion suggestions from a single analysis
-- Enables: pause/resume, progress tracking, session management

CREATE TABLE IF NOT EXISTS fusion_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Document references
  doc1_id UUID REFERENCES parsed_documents(id) ON DELETE CASCADE,
  doc2_id UUID REFERENCES parsed_documents(id) ON DELETE CASCADE,

  -- Session identification
  session_name TEXT,
  -- Example: "ProCert 2025 vs ISO 9001"

  -- Processing status
  status TEXT DEFAULT 'created',
  -- Values: created → analyzing → ready → in_review → completed → archived

  -- Statistics
  total_pairs_analyzed INTEGER DEFAULT 0,
  total_suggestions INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  edited_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,

  -- Confidence stats
  avg_confidence DECIMAL(5,2),
  high_confidence_count INTEGER DEFAULT 0, -- ≥80%
  medium_confidence_count INTEGER DEFAULT 0, -- 70-79%

  -- Workflow info
  workflow_version TEXT DEFAULT 'v1',
  processing_time_seconds INTEGER,

  -- User tracking
  created_by TEXT,
  reviewed_by TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analysis_started_at TIMESTAMP WITH TIME ZONE,
  analysis_completed_at TIMESTAMP WITH TIME ZONE,
  review_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fusion_sessions_docs
  ON fusion_sessions(doc1_id, doc2_id);
CREATE INDEX IF NOT EXISTS idx_fusion_sessions_status
  ON fusion_sessions(status);
CREATE INDEX IF NOT EXISTS idx_fusion_sessions_created
  ON fusion_sessions(created_at DESC);

-- Unique constraint: prevent duplicate sessions for same doc pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_fusion_sessions_unique_docs
  ON fusion_sessions(doc1_id, doc2_id)
  WHERE status NOT IN ('completed', 'archived');

-- Comments
COMMENT ON TABLE fusion_sessions IS 'Tracks fusion analysis sessions - groups related suggestions';
COMMENT ON COLUMN fusion_sessions.status IS 'created → analyzing → ready → in_review → completed → archived';
COMMENT ON COLUMN fusion_sessions.session_name IS 'User-friendly name like "ProCert 2025 vs ISO 9001"';

-- =====================================================
-- TABLE 3: fusion_suggestions
-- =====================================================
-- Individual AI-generated fusion suggestions awaiting review
-- Each suggestion links items from doc1 and doc2 with confidence score

CREATE TABLE IF NOT EXISTS fusion_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Session reference
  session_id UUID REFERENCES fusion_sessions(id) ON DELETE CASCADE,

  -- Fusion identification
  fusion_id TEXT NOT NULL,
  -- Example: "fusion_001", unique within session

  -- Source document references
  doc1_id UUID REFERENCES parsed_documents(id) ON DELETE CASCADE,
  doc2_id UUID REFERENCES parsed_documents(id) ON DELETE CASCADE,

  -- Source items (references to original checklist items)
  doc1_item_ids TEXT[] NOT NULL,
  -- Example: ["a.fiche-d-information-y-c-annexe"]

  doc2_item_ids TEXT[] NOT NULL,
  -- Example: ["iso.4.1.2", "iso.4.1.3"]

  -- AI analysis results
  merged_item JSONB NOT NULL,
  -- Complete merged checklist item structure:
  -- {
  --   "id": "fusion.001",
  --   "section": "A. Généralités / ISO 4.1",
  --   "sous_section": "Documentation",
  --   "question": "Unified question text",
  --   "status": "RN",
  --   "options": [...],
  --   "notes": "Combined notes",
  --   "page": "doc1: 1, doc2: 3",
  --   "sources": { "doc1": {...}, "doc2": {...} }
  -- }

  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level TEXT,
  -- Values: very_high (90+), high (75-89), medium (70-74), low (<70)

  explanation TEXT,
  -- AI's reasoning for why items can be fused

  -- Review status and tracking
  status TEXT DEFAULT 'pending',
  -- Values: pending → accepted/rejected/edited

  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- If edited: store custom version
  edited_item JSONB,
  -- Same structure as merged_item but with manual modifications

  edit_notes TEXT,
  -- Optional: why was it edited?

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fusion_suggestions_session
  ON fusion_suggestions(session_id);
CREATE INDEX IF NOT EXISTS idx_fusion_suggestions_status
  ON fusion_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_fusion_suggestions_confidence
  ON fusion_suggestions(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_fusion_suggestions_docs
  ON fusion_suggestions(doc1_id, doc2_id);

-- GIN index for JSONB queries (search within merged_item)
CREATE INDEX IF NOT EXISTS idx_fusion_suggestions_merged_item
  ON fusion_suggestions USING gin(merged_item);

-- Unique constraint: prevent duplicate fusion_id within session
CREATE UNIQUE INDEX IF NOT EXISTS idx_fusion_suggestions_unique_fusion
  ON fusion_suggestions(session_id, fusion_id);

-- Comments
COMMENT ON TABLE fusion_suggestions IS 'Individual AI fusion suggestions awaiting boss review';
COMMENT ON COLUMN fusion_suggestions.fusion_id IS 'Unique identifier within session (fusion_001, fusion_002, etc.)';
COMMENT ON COLUMN fusion_suggestions.doc1_item_ids IS 'Array of item IDs from first document';
COMMENT ON COLUMN fusion_suggestions.doc2_item_ids IS 'Array of item IDs from second document';
COMMENT ON COLUMN fusion_suggestions.merged_item IS 'Complete merged checklist item with all fields';
COMMENT ON COLUMN fusion_suggestions.edited_item IS 'If boss edited: custom version of merged_item';
COMMENT ON COLUMN fusion_suggestions.status IS 'pending → accepted/rejected/edited';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp on fusion_suggestions
CREATE OR REPLACE FUNCTION update_fusion_suggestion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fusion_suggestions_updated_at ON fusion_suggestions;
CREATE TRIGGER trigger_fusion_suggestions_updated_at
  BEFORE UPDATE ON fusion_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_fusion_suggestion_timestamp();

-- Auto-update session statistics when suggestions change
CREATE OR REPLACE FUNCTION update_fusion_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update counts in fusion_sessions
  UPDATE fusion_sessions
  SET
    total_suggestions = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
    ),
    accepted_count = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        AND status = 'accepted'
    ),
    rejected_count = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        AND status = 'rejected'
    ),
    edited_count = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        AND status = 'edited'
    ),
    pending_count = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        AND status = 'pending'
    ),
    avg_confidence = (
      SELECT AVG(confidence_score)::DECIMAL(5,2)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
    ),
    high_confidence_count = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        AND confidence_score >= 80
    ),
    medium_confidence_count = (
      SELECT COUNT(*)
      FROM fusion_suggestions
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
        AND confidence_score >= 70 AND confidence_score < 80
    )
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_stats ON fusion_suggestions;
CREATE TRIGGER trigger_update_session_stats
  AFTER INSERT OR UPDATE OR DELETE ON fusion_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_fusion_session_stats();

-- Auto-update last_accessed_at on parsed_documents when used
CREATE OR REPLACE FUNCTION update_document_access_time()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE parsed_documents
  SET last_accessed_at = NOW()
  WHERE id IN (NEW.doc1_id, NEW.doc2_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_document_access ON fusion_sessions;
CREATE TRIGGER trigger_update_document_access
  AFTER INSERT ON fusion_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_document_access_time();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- For now: Allow all operations (adjust for production with authentication)

ALTER TABLE parsed_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on parsed_documents"
  ON parsed_documents FOR ALL USING (true);

ALTER TABLE fusion_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on fusion_sessions"
  ON fusion_sessions FOR ALL USING (true);

ALTER TABLE fusion_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on fusion_suggestions"
  ON fusion_suggestions FOR ALL USING (true);

-- For production: Replace with authenticated policies like:
-- CREATE POLICY "Users can read their own sessions"
--   ON fusion_sessions FOR SELECT
--   USING (created_by = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get session summary with document info
CREATE OR REPLACE FUNCTION get_fusion_session_summary(session_uuid UUID)
RETURNS TABLE (
  session_id UUID,
  session_name TEXT,
  status TEXT,
  doc1_name TEXT,
  doc2_name TEXT,
  total_suggestions INTEGER,
  accepted_count INTEGER,
  rejected_count INTEGER,
  pending_count INTEGER,
  avg_confidence DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fs.id,
    fs.session_name,
    fs.status,
    pd1.file_name,
    pd2.file_name,
    fs.total_suggestions,
    fs.accepted_count,
    fs.rejected_count,
    fs.pending_count,
    fs.avg_confidence,
    fs.created_at
  FROM fusion_sessions fs
  JOIN parsed_documents pd1 ON fs.doc1_id = pd1.id
  JOIN parsed_documents pd2 ON fs.doc2_id = pd2.id
  WHERE fs.id = session_uuid;
END;
$$ LANGUAGE plpgsql;

-- Find existing session for document pair
CREATE OR REPLACE FUNCTION find_session_by_documents(doc1_uuid UUID, doc2_uuid UUID)
RETURNS TABLE (
  session_id UUID,
  session_name TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    session_name,
    status,
    created_at
  FROM fusion_sessions
  WHERE (doc1_id = doc1_uuid AND doc2_id = doc2_uuid)
     OR (doc1_id = doc2_uuid AND doc2_id = doc1_uuid)
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if migration succeeded
DO $$
BEGIN
  RAISE NOTICE 'Migration complete! Created tables:';
  RAISE NOTICE '  - parsed_documents';
  RAISE NOTICE '  - fusion_sessions';
  RAISE NOTICE '  - fusion_suggestions';
  RAISE NOTICE '';
  RAISE NOTICE 'Run these queries to verify:';
  RAISE NOTICE '  SELECT * FROM parsed_documents LIMIT 5;';
  RAISE NOTICE '  SELECT * FROM fusion_sessions LIMIT 5;';
  RAISE NOTICE '  SELECT * FROM fusion_suggestions LIMIT 5;';
END $$;

-- Show table structures
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('parsed_documents', 'fusion_sessions', 'fusion_suggestions')
ORDER BY table_name, ordinal_position;
