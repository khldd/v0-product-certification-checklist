/**
 * Database operations for fusion workflow with Supabase
 * Handles: parsed_documents, fusion_sessions, fusion_suggestions
 */

import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let supabase: any = null

// Initialize Supabase client
function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[DatabaseFusion] Supabase credentials not configured')
    return null
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey)
  }

  return supabase
}

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface ParsedDocument {
  id?: string
  file_name: string
  file_hash: string
  file_size_bytes?: number
  document_metadata?: any
  sections: any[] // Full nested Unstruct structure
  total_items?: number
  total_sections?: number
  created_at?: string
  last_accessed_at?: string
}

export interface FusionSession {
  id?: string
  doc1_id: string
  doc2_id: string
  session_name?: string
  status?: 'created' | 'analyzing' | 'ready' | 'in_review' | 'completed' | 'archived'
  total_pairs_analyzed?: number
  total_suggestions?: number
  accepted_count?: number
  rejected_count?: number
  edited_count?: number
  pending_count?: number
  avg_confidence?: number
  high_confidence_count?: number
  medium_confidence_count?: number
  workflow_version?: string
  processing_time_seconds?: number
  created_by?: string
  reviewed_by?: string
  created_at?: string
  analysis_started_at?: string
  analysis_completed_at?: string
  review_started_at?: string
  completed_at?: string
}

export interface FusionSuggestion {
  id?: string
  session_id: string
  fusion_id: string
  doc1_id: string
  doc2_id: string
  doc1_item_ids: string[]
  doc2_item_ids: string[]
  merged_item: any // Complete merged checklist item
  confidence_score: number
  confidence_level: string
  explanation: string
  status?: 'pending' | 'accepted' | 'rejected' | 'edited'
  reviewed_by?: string
  reviewed_at?: string
  edited_item?: any
  edit_notes?: string
  created_at?: string
  updated_at?: string
}

export interface DbResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// =====================================================
// PARSED DOCUMENTS OPERATIONS
// =====================================================

/**
 * Save or update a parsed document
 * If file_hash exists: update access time
 * If new: insert document
 */
export async function saveParsedDocument(doc: ParsedDocument): Promise<DbResponse<ParsedDocument>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    // Check if document already exists by hash
    const { data: existing } = await client
      .from('parsed_documents')
      .select('id')
      .eq('file_hash', doc.file_hash)
      .single()

    if (existing) {
      // Update last_accessed_at
      const { data, error } = await client
        .from('parsed_documents')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[DatabaseFusion] Update document error:', error)
        return { success: false, error: error.message }
      }

      console.log('[DatabaseFusion] Document already exists, updated access time:', existing.id)
      return { success: true, data }
    }

    // Insert new document
    const { data, error } = await client
      .from('parsed_documents')
      .insert([{
        file_name: doc.file_name,
        file_hash: doc.file_hash,
        file_size_bytes: doc.file_size_bytes,
        document_metadata: doc.document_metadata || {},
        sections: doc.sections,
        total_items: doc.total_items || 0,
        total_sections: doc.total_sections || 0
      }])
      .select()
      .single()

    if (error) {
      console.error('[DatabaseFusion] Insert document error:', error)
      return { success: false, error: error.message }
    }

    console.log('[DatabaseFusion] Saved new document:', data.id)
    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Save document exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Find document by file hash (for caching)
 */
export async function findDocumentByHash(fileHash: string): Promise<DbResponse<ParsedDocument>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('parsed_documents')
      .select('*')
      .eq('file_hash', fileHash)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[DatabaseFusion] Find document error:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: true, data: undefined }
    }

    console.log('[DatabaseFusion] Found cached document:', data.id)
    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Find document exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Get document by ID
 */
export async function getDocumentById(docId: string): Promise<DbResponse<ParsedDocument>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('parsed_documents')
      .select('*')
      .eq('id', docId)
      .single()

    if (error) {
      console.error('[DatabaseFusion] Get document error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Get document exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * List recent documents
 */
export async function listRecentDocuments(limit: number = 20): Promise<DbResponse<ParsedDocument[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('parsed_documents')
      .select('id, file_name, file_hash, document_metadata, total_items, created_at, last_accessed_at')
      .order('last_accessed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[DatabaseFusion] List documents error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }

  } catch (err) {
    console.error('[DatabaseFusion] List documents exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// =====================================================
// FUSION SESSIONS OPERATIONS
// =====================================================

/**
 * Create a new fusion session
 */
export async function createFusionSession(session: FusionSession): Promise<DbResponse<FusionSession>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_sessions')
      .insert([{
        doc1_id: session.doc1_id,
        doc2_id: session.doc2_id,
        session_name: session.session_name,
        status: session.status || 'created',
        created_by: session.created_by,
        workflow_version: session.workflow_version || 'v1'
      }])
      .select()
      .single()

    if (error) {
      console.error('[DatabaseFusion] Create session error:', error)
      return { success: false, error: error.message }
    }

    console.log('[DatabaseFusion] Created fusion session:', data.id)
    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Create session exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Update fusion session
 */
export async function updateFusionSession(sessionId: string, updates: Partial<FusionSession>): Promise<DbResponse<FusionSession>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('[DatabaseFusion] Update session error:', error)
      return { success: false, error: error.message }
    }

    console.log('[DatabaseFusion] Updated fusion session:', sessionId)
    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Update session exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Get fusion session by ID
 */
export async function getFusionSession(sessionId: string): Promise<DbResponse<FusionSession>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('[DatabaseFusion] Get session error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Get session exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Find existing session for document pair
 */
export async function findSessionByDocuments(doc1Id: string, doc2Id: string): Promise<DbResponse<FusionSession>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    // Check both orderings (doc1+doc2 and doc2+doc1)
    const { data, error } = await client
      .from('fusion_sessions')
      .select('*')
      .or(`and(doc1_id.eq.${doc1Id},doc2_id.eq.${doc2Id}),and(doc1_id.eq.${doc2Id},doc2_id.eq.${doc1Id})`)
      .in('status', ['created', 'analyzing', 'ready', 'in_review'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[DatabaseFusion] Find session error:', error)
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: true, data: undefined }
    }

    console.log('[DatabaseFusion] Found existing session:', data[0].id)
    return { success: true, data: data[0] }

  } catch (err) {
    console.error('[DatabaseFusion] Find session exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * List recent fusion sessions
 */
export async function listFusionSessions(limit: number = 20): Promise<DbResponse<FusionSession[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_sessions')
      .select(`
        *,
        doc1:doc1_id(file_name, document_metadata),
        doc2:doc2_id(file_name, document_metadata)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[DatabaseFusion] List sessions error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }

  } catch (err) {
    console.error('[DatabaseFusion] List sessions exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// =====================================================
// FUSION SUGGESTIONS OPERATIONS
// =====================================================

/**
 * Save multiple fusion suggestions (batch)
 */
export async function saveFusionSuggestions(suggestions: FusionSuggestion[]): Promise<DbResponse<FusionSuggestion[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_suggestions')
      .insert(suggestions.map(s => ({
        session_id: s.session_id,
        fusion_id: s.fusion_id,
        doc1_id: s.doc1_id,
        doc2_id: s.doc2_id,
        doc1_item_ids: s.doc1_item_ids,
        doc2_item_ids: s.doc2_item_ids,
        merged_item: s.merged_item,
        confidence_score: s.confidence_score,
        confidence_level: s.confidence_level,
        explanation: s.explanation,
        status: s.status || 'pending'
      })))
      .select()

    if (error) {
      console.error('[DatabaseFusion] Save suggestions error:', error)
      return { success: false, error: error.message }
    }

    console.log('[DatabaseFusion] Saved', data?.length || 0, 'fusion suggestions')
    return { success: true, data: data || [] }

  } catch (err) {
    console.error('[DatabaseFusion] Save suggestions exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Update fusion suggestion status
 */
export async function updateFusionSuggestion(
  suggestionId: string,
  updates: Partial<FusionSuggestion>
): Promise<DbResponse<FusionSuggestion>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_suggestions')
      .update({
        ...updates,
        reviewed_at: updates.status && updates.status !== 'pending' ? new Date().toISOString() : undefined
      })
      .eq('id', suggestionId)
      .select()
      .single()

    if (error) {
      console.error('[DatabaseFusion] Update suggestion error:', error)
      return { success: false, error: error.message }
    }

    console.log('[DatabaseFusion] Updated suggestion:', suggestionId, 'status:', updates.status)
    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Update suggestion exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Get suggestions for a session
 */
export async function getSessionSuggestions(
  sessionId: string,
  status?: string
): Promise<DbResponse<FusionSuggestion[]>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    let query = client
      .from('fusion_suggestions')
      .select('*')
      .eq('session_id', sessionId)
      .order('confidence_score', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[DatabaseFusion] Get suggestions error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }

  } catch (err) {
    console.error('[DatabaseFusion] Get suggestions exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Get suggestion by ID
 */
export async function getFusionSuggestion(suggestionId: string): Promise<DbResponse<FusionSuggestion>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fusion_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single()

    if (error) {
      console.error('[DatabaseFusion] Get suggestion error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Get suggestion exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Delete fusion suggestion
 */
export async function deleteFusionSuggestion(suggestionId: string): Promise<DbResponse<void>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { error } = await client
      .from('fusion_suggestions')
      .delete()
      .eq('id', suggestionId)

    if (error) {
      console.error('[DatabaseFusion] Delete suggestion error:', error)
      return { success: false, error: error.message }
    }

    console.log('[DatabaseFusion] Deleted suggestion:', suggestionId)
    return { success: true }

  } catch (err) {
    console.error('[DatabaseFusion] Delete suggestion exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Calculate SHA-256 hash of file
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  } catch (err) {
    console.error('[DatabaseFusion] Hash calculation error:', err)
    throw new Error('Failed to calculate file hash')
  }
}

/**
 * Flatten nested Unstruct sections structure to flat array
 */
export function flattenChecklistSections(sections: any[]): any[] {
  const flatItems: any[] = []

  if (!sections || !Array.isArray(sections)) return flatItems

  for (const section of sections) {
    for (const item of section.items || []) {
      flatItems.push({
        ...item,
        // Add section info to each item
        section: section.title || `${section.letter}. ${section.title}`,
        section_letter: section.letter,
        section_title: section.title,
        // Normalize field names
        question: item.label || item.question,
        sous_section: item.subsection || item.sous_section
      })
    }
  }

  return flatItems
}

/**
 * Get session summary with document names
 */
export async function getSessionSummary(sessionId: string): Promise<DbResponse<any>> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .rpc('get_fusion_session_summary', { session_uuid: sessionId })
      .single()

    if (error) {
      console.error('[DatabaseFusion] Get session summary error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }

  } catch (err) {
    console.error('[DatabaseFusion] Get session summary exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Convert fusion suggestions to final checklist format
 */
export function suggestionsToFusedChecklist(
  suggestions: FusionSuggestion[],
  doc1Name: string,
  doc2Name: string
): any {
  return {
    checklist_name: `${doc1Name} + ${doc2Name} (Fused)`,
    doc1_name: doc1Name,
    doc2_name: doc2Name,
    fused_items: suggestions
      .filter(s => s.status === 'accepted' || s.status === 'edited')
      .map(s => ({
        fusion_id: s.fusion_id,
        fused_text: s.merged_item.question,
        type: s.status === 'edited' ? 'manual_fused' : 'ai_fused',
        confidence: s.confidence_score,
        confidence_level: s.confidence_level,
        mappings: [
          ...s.doc1_item_ids.map(id => ({
            checklist: 'doc1',
            item_id: id
          })),
          ...s.doc2_item_ids.map(id => ({
            checklist: 'doc2',
            item_id: id
          }))
        ],
        section: s.merged_item.section,
        sous_section: s.merged_item.sous_section,
        status: s.merged_item.status,
        options: s.merged_item.options,
        notes: s.merged_item.notes,
        validated: true,
        validated_at: s.reviewed_at
      }))
  }
}
