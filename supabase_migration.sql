-- Migration: Create fused_checklists table
-- Purpose: Store validated fusion checklists for reuse across audits

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create fused_checklists table
CREATE TABLE IF NOT EXISTS fused_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Checklist identification
  checklist_name TEXT NOT NULL,
  doc1_name TEXT NOT NULL,
  doc2_name TEXT NOT NULL,
  doc1_hash TEXT NOT NULL,
  doc2_hash TEXT NOT NULL,

  -- Fused items data (JSONB for flexibility)
  fused_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Validation tracking
  validated_by TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_fused_checklists_doc_hashes
  ON fused_checklists(doc1_hash, doc2_hash);

CREATE INDEX IF NOT EXISTS idx_fused_checklists_created_at
  ON fused_checklists(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fused_checklists_names
  ON fused_checklists(doc1_name, doc2_name);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS update_fused_checklists_updated_at ON fused_checklists;
CREATE TRIGGER update_fused_checklists_updated_at
  BEFORE UPDATE ON fused_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE fused_checklists IS 'Stores validated fusion checklists for reuse across multiple audits';
COMMENT ON COLUMN fused_checklists.checklist_name IS 'User-friendly name for this fused checklist';
COMMENT ON COLUMN fused_checklists.doc1_name IS 'Original name of first document';
COMMENT ON COLUMN fused_checklists.doc2_name IS 'Original name of second document';
COMMENT ON COLUMN fused_checklists.doc1_hash IS 'SHA-256 hash of first document for cache matching';
COMMENT ON COLUMN fused_checklists.doc2_hash IS 'SHA-256 hash of second document for cache matching';
COMMENT ON COLUMN fused_checklists.fused_items IS 'Array of fused items with mappings to original items';
COMMENT ON COLUMN fused_checklists.metadata IS 'Additional metadata (document info, statistics, etc.)';
COMMENT ON COLUMN fused_checklists.validated_by IS 'User who validated this fusion (e.g., boss name)';

-- Example fused_items structure (for documentation):
/*
[
  {
    "fusion_id": "fusion_001",
    "fused_text": "Le contrat de licence existe, est signé et valide",
    "type": "ai_fused",
    "confidence": 92,
    "confidence_level": "very_high",
    "mappings": [
      {
        "checklist": "doc1",
        "item_id": "a.1.2",
        "original_text": "License contract exists and is signed",
        "section": "A. Licensing",
        "sous_section": "Contracts"
      },
      {
        "checklist": "doc2",
        "item_id": "b.3.1",
        "original_text": "Valid signed license contract",
        "section": "B. Documentation",
        "sous_section": "Contracts"
      }
    ],
    "section": "A. Licensing / Documentation",
    "sous_section": "Contracts",
    "status": "RN",
    "options": [
      {
        "label": "Exists, signed and valid",
        "source": "both",
        "original_doc1": "exists and is signed",
        "original_doc2": "Valid and signed",
        "checked": null
      }
    ],
    "notes": null,
    "page": "doc1: 1, doc2: 3",
    "validated": true,
    "validated_at": "2024-11-10T10:30:00Z"
  }
]
*/

-- Grant permissions (adjust based on your Supabase setup)
-- For authenticated users only:
-- ALTER TABLE fused_checklists ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated users to read fused_checklists"
--   ON fused_checklists FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Allow authenticated users to insert fused_checklists"
--   ON fused_checklists FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Allow authenticated users to update their fused_checklists"
--   ON fused_checklists FOR UPDATE TO authenticated USING (true);

-- For now, allow public access (adjust security in production!)
ALTER TABLE fused_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to fused_checklists"
  ON fused_checklists FOR ALL USING (true);

-- Verification query
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fused_checklists'
ORDER BY ordinal_position;
