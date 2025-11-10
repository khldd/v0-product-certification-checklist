-- Create checklist_cache table in Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS checklist_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_hash TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  checklist_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on file_hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_checklist_cache_file_hash ON checklist_cache(file_hash);

-- Create index on file_name for searching
CREATE INDEX IF NOT EXISTS idx_checklist_cache_file_name ON checklist_cache(file_name);

-- Enable Row Level Security (RLS)
ALTER TABLE checklist_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on checklist_cache" 
ON checklist_cache 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Optional: Add a comment
COMMENT ON TABLE checklist_cache IS 'Cache for analyzed PDF checklists to avoid re-processing';
