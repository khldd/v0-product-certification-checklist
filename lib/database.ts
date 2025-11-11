/**
 * Database utility functions for managing fused checklists
 * Uses Supabase for storage
 */

import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let supabase: any = null

// Initialize Supabase client
function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Database] Supabase credentials not configured')
    return null
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey)
  }

  return supabase
}

export interface FusedChecklistData {
  id?: string
  checklist_name: string
  doc1_name: string
  doc2_name: string
  doc1_hash: string
  doc2_hash: string
  fused_items: FusedItem[]
  metadata?: any
  validated_by?: string
  created_at?: string
  updated_at?: string
}

export interface FusedItem {
  fusion_id: string
  fused_text: string
  type: 'ai_fused' | 'manual_fused' | 'kept_separate'
  confidence?: number
  confidence_level?: string
  mappings: ItemMapping[]
  section?: string
  sous_section?: string
  status?: string
  options?: any[]
  notes?: string
  page?: string
  validated: boolean
  validated_at?: string
}

export interface ItemMapping {
  checklist: 'doc1' | 'doc2'
  item_id: string
  original_text: string
  section?: string
  sous_section?: string
}

/**
 * Save a fused checklist to the database
 */
export async function saveFusedChecklist(data: FusedChecklistData): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = getSupabaseClient()

  if (!client) {
    console.warn('[Database] Skipping save - Supabase not configured')
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data: result, error } = await client
      .from('fused_checklists')
      .insert([{
        checklist_name: data.checklist_name,
        doc1_name: data.doc1_name,
        doc2_name: data.doc2_name,
        doc1_hash: data.doc1_hash,
        doc2_hash: data.doc2_hash,
        fused_items: data.fused_items,
        metadata: data.metadata || {},
        validated_by: data.validated_by || 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('[Database] Save error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Database] Saved fused checklist:', result.id)
    return { success: true, id: result.id }

  } catch (err) {
    console.error('[Database] Save exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Update an existing fused checklist
 */
export async function updateFusedChecklist(id: string, data: Partial<FusedChecklistData>): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()

  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { error } = await client
      .from('fused_checklists')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('[Database] Update error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Database] Updated fused checklist:', id)
    return { success: true }

  } catch (err) {
    console.error('[Database] Update exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Load a fused checklist by ID
 */
export async function loadFusedChecklist(id: string): Promise<{ success: boolean; data?: FusedChecklistData; error?: string }> {
  const client = getSupabaseClient()

  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fused_checklists')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[Database] Load error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Database] Loaded fused checklist:', id)
    return { success: true, data }

  } catch (err) {
    console.error('[Database] Load exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Find existing fused checklist by document hashes
 */
export async function findFusedChecklistByHashes(doc1Hash: string, doc2Hash: string): Promise<{ success: boolean; data?: FusedChecklistData; error?: string }> {
  const client = getSupabaseClient()

  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    // Try both hash orders (doc1+doc2 and doc2+doc1)
    const { data, error } = await client
      .from('fused_checklists')
      .select('*')
      .or(`and(doc1_hash.eq.${doc1Hash},doc2_hash.eq.${doc2Hash}),and(doc1_hash.eq.${doc2Hash},doc2_hash.eq.${doc1Hash})`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[Database] Find error:', error)
      return { success: false, error: error.message }
    }

    if (data && data.length > 0) {
      console.log('[Database] Found existing fusion for these documents')
      return { success: true, data: data[0] }
    }

    return { success: true, data: undefined }

  } catch (err) {
    console.error('[Database] Find exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * List all fused checklists
 */
export async function listFusedChecklists(limit: number = 50): Promise<{ success: boolean; data?: FusedChecklistData[]; error?: string }> {
  const client = getSupabaseClient()

  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { data, error } = await client
      .from('fused_checklists')
      .select('id, checklist_name, doc1_name, doc2_name, created_at, updated_at, validated_by')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Database] List error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Database] Listed', data?.length || 0, 'fused checklists')
    return { success: true, data: data || [] }

  } catch (err) {
    console.error('[Database] List exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Delete a fused checklist
 */
export async function deleteFusedChecklist(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient()

  if (!client) {
    return { success: false, error: 'Database not configured' }
  }

  try {
    const { error } = await client
      .from('fused_checklists')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Database] Delete error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Database] Deleted fused checklist:', id)
    return { success: true }

  } catch (err) {
    console.error('[Database] Delete exception:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Convert auto-fusion results to fused items format
 */
export function convertAutoFusionsToFusedItems(autoFusions: any[]): FusedItem[] {
  return autoFusions.map(fusion => ({
    fusion_id: fusion.fusion_id,
    fused_text: fusion.result?.merged_item?.question || '',
    type: 'ai_fused' as const,
    confidence: fusion.fusion_decision?.confidence_score,
    confidence_level: fusion.fusion_decision?.confidence_level,
    mappings: [
      ...fusion.doc1_items.map((item: any) => ({
        checklist: 'doc1' as const,
        item_id: item.id,
        original_text: item.question || item.label,
        section: item.section,
        sous_section: item.sous_section
      })),
      ...fusion.doc2_items.map((item: any) => ({
        checklist: 'doc2' as const,
        item_id: item.id,
        original_text: item.question || item.label,
        section: item.section,
        sous_section: item.sous_section
      }))
    ],
    section: fusion.result?.merged_item?.section,
    sous_section: fusion.result?.merged_item?.sous_section,
    status: fusion.result?.merged_item?.status,
    options: fusion.result?.merged_item?.options,
    notes: fusion.result?.merged_item?.notes,
    page: fusion.result?.merged_item?.page,
    validated: false
  }))
}
