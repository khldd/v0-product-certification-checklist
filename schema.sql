-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.checklist_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_hash text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  checklist_data jsonb NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT checklist_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fusion_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  doc1_id uuid,
  doc2_id uuid,
  session_name text,
  status text DEFAULT 'created'::text,
  total_pairs_analyzed integer DEFAULT 0,
  total_suggestions integer DEFAULT 0,
  accepted_count integer DEFAULT 0,
  rejected_count integer DEFAULT 0,
  edited_count integer DEFAULT 0,
  pending_count integer DEFAULT 0,
  avg_confidence numeric,
  high_confidence_count integer DEFAULT 0,
  medium_confidence_count integer DEFAULT 0,
  workflow_version text DEFAULT 'v1'::text,
  processing_time_seconds integer,
  created_by text,
  reviewed_by text,
  created_at timestamp with time zone DEFAULT now(),
  analysis_started_at timestamp with time zone,
  analysis_completed_at timestamp with time zone,
  review_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT fusion_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT fusion_sessions_doc1_id_fkey FOREIGN KEY (doc1_id) REFERENCES public.parsed_documents(id),
  CONSTRAINT fusion_sessions_doc2_id_fkey FOREIGN KEY (doc2_id) REFERENCES public.parsed_documents(id)
);
CREATE TABLE public.fusion_suggestions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid,
  fusion_id text NOT NULL,
  doc1_id uuid,
  doc2_id uuid,
  doc1_item_ids ARRAY NOT NULL,
  doc2_item_ids ARRAY NOT NULL,
  merged_item jsonb NOT NULL,
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level text,
  explanation text,
  status text DEFAULT 'pending'::text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  edited_item jsonb,
  edit_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fusion_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT fusion_suggestions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.fusion_sessions(id),
  CONSTRAINT fusion_suggestions_doc1_id_fkey FOREIGN KEY (doc1_id) REFERENCES public.parsed_documents(id),
  CONSTRAINT fusion_suggestions_doc2_id_fkey FOREIGN KEY (doc2_id) REFERENCES public.parsed_documents(id)
);
CREATE TABLE public.parsed_documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  file_name text NOT NULL,
  file_hash text NOT NULL UNIQUE,
  file_size_bytes bigint,
  document_metadata jsonb DEFAULT '{}'::jsonb,
  sections jsonb NOT NULL,
  total_items integer DEFAULT 0,
  total_sections integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT parsed_documents_pkey PRIMARY KEY (id)
);