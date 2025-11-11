/**
 * Supabase Client Configuration
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions matching our schema
export interface ParsedDocument {
  id: string
  file_name: string
  file_hash: string
  file_size_bytes: number
  document_metadata: any
  sections: any
  total_items: number
  total_sections: number
  created_at: string
  last_accessed_at: string
}

export interface FusionSession {
  id: string
  doc1_id: string
  doc2_id: string
  session_name?: string
  status: 'created' | 'analyzing' | 'completed' | 'error'
  total_pairs_analyzed: number
  total_suggestions: number
  accepted_count: number
  rejected_count: number
  edited_count: number
  pending_count: number
  avg_confidence?: number
  high_confidence_count: number
  medium_confidence_count: number
  workflow_version: string
  processing_time_seconds?: number
  created_by?: string
  reviewed_by?: string
  created_at: string
  analysis_started_at?: string
  analysis_completed_at?: string
  review_started_at?: string
  completed_at?: string
}

export interface FusionSuggestion {
  id: string
  session_id: string
  fusion_id: string
  doc1_id: string
  doc2_id: string
  doc1_item_ids: string[]
  doc2_item_ids: string[]
  merged_item: any
  confidence_score: number
  confidence_level: string
  explanation: string
  status: 'pending' | 'accepted' | 'rejected' | 'edited'
  reviewed_by?: string
  reviewed_at?: string
  edited_item?: any
  edit_notes?: string
  created_at: string
  updated_at: string
  batch_number?: number
  section_name?: string
  original_doc1_items?: any
  original_doc2_items?: any
}
