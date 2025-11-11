/**
 * Supabase Database Utilities
 *
 * Functions for interacting with the database tables
 */

import { supabase, ParsedDocument, FusionSession, FusionSuggestion } from './supabase-client'

/**
 * Generate SHA-256 hash of file for caching
 */
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Save or update parsed document in cache
 */
export async function saveParsedDocument(
  fileHash: string,
  fileName: string,
  fileSize: number,
  sections: any,
  metadata: any = {}
): Promise<ParsedDocument | null> {
  try {
    const totalSections = Array.isArray(sections) ? sections.length : Object.keys(sections).length
    let totalItems = 0

    if (Array.isArray(sections)) {
      sections.forEach((section: any) => {
        if (section.items) totalItems += section.items.length
      })
    }

    // Check if document exists
    const { data: existing } = await supabase
      .from('parsed_documents')
      .select('id')
      .eq('file_hash', fileHash)
      .single()

    if (existing) {
      // Update last_accessed_at
      const { data, error } = await supabase
        .from('parsed_documents')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('file_hash', fileHash)
        .select()
        .single()

      if (error) throw error
      console.log('[Supabase] Updated existing document:', data.id)
      return data
    }

    // Insert new document
    const { data, error } = await supabase
      .from('parsed_documents')
      .insert({
        file_name: fileName,
        file_hash: fileHash,
        file_size_bytes: fileSize,
        document_metadata: metadata,
        sections: sections,
        total_items: totalItems,
        total_sections: totalSections
      })
      .select()
      .single()

    if (error) throw error
    console.log('[Supabase] Saved new document:', data.id)
    return data
  } catch (err) {
    console.error('[Supabase] Error saving document:', err)
    return null
  }
}

/**
 * Get parsed document from cache by file hash
 */
export async function getParsedDocument(fileHash: string): Promise<ParsedDocument | null> {
  try {
    const { data, error } = await supabase
      .from('parsed_documents')
      .select('*')
      .eq('file_hash', fileHash)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    // Update last accessed
    await supabase
      .from('parsed_documents')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', data.id)

    console.log('[Supabase] Retrieved cached document:', data.id)
    return data
  } catch (err) {
    console.error('[Supabase] Error getting document:', err)
    return null
  }
}

/**
 * Create a new fusion session
 */
export async function createFusionSession(
  doc1Id: string,
  doc2Id: string,
  sessionName?: string
): Promise<FusionSession | null> {
  try {
    const { data, error } = await supabase
      .from('fusion_sessions')
      .insert({
        doc1_id: doc1Id,
        doc2_id: doc2Id,
        session_name: sessionName || `Session ${new Date().toLocaleDateString()}`,
        status: 'created',
        workflow_version: 'v3-auto-fusion',
        analysis_started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    console.log('[Supabase] Created fusion session:', data.id)
    return data
  } catch (err) {
    console.error('[Supabase] Error creating session:', err)
    return null
  }
}

/**
 * Get existing session or create new one for document pair
 * Prevents duplicate session errors
 */
export async function getOrCreateFusionSession(
  doc1Id: string,
  doc2Id: string,
  sessionName?: string
): Promise<FusionSession | null> {
  try {
    // Check for existing session (not completed or archived)
    const { data: existingSession, error: queryError } = await supabase
      .from('fusion_sessions')
      .select('*')
      .eq('doc1_id', doc1Id)
      .eq('doc2_id', doc2Id)
      .not('status', 'in', '(completed,archived)')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) throw queryError

    if (existingSession) {
      console.log('[Supabase] Found existing session:', existingSession.id)
      // Update analysis_started_at to current time for resumed session
      await supabase
        .from('fusion_sessions')
        .update({ analysis_started_at: new Date().toISOString() })
        .eq('id', existingSession.id)
      return existingSession
    }

    // No existing session, create new one
    return await createFusionSession(doc1Id, doc2Id, sessionName)
  } catch (err) {
    console.error('[Supabase] Error getting/creating session:', err)
    return null
  }
}

/**
 * Update fusion session status and stats
 */
export async function updateFusionSession(
  sessionId: string,
  updates: Partial<FusionSession>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('fusion_sessions')
      .update(updates)
      .eq('id', sessionId)

    if (error) throw error
    console.log('[Supabase] Updated session:', sessionId)
    return true
  } catch (err) {
    console.error('[Supabase] Error updating session:', err)
    return false
  }
}

/**
 * Save fusion suggestions (bulk insert)
 */
export async function saveFusionSuggestions(
  sessionId: string,
  doc1Id: string,
  doc2Id: string,
  suggestions: any[]
): Promise<FusionSuggestion[]> {
  try {
    const suggestionsData = suggestions.map(s => ({
      session_id: sessionId,
      fusion_id: s.fusion_id,
      doc1_id: doc1Id,
      doc2_id: doc2Id,
      doc1_item_ids: s.doc1_items?.map((item: any) => item.id) || [],
      doc2_item_ids: s.doc2_items?.map((item: any) => item.id) || [],
      merged_item: s.result?.merged_item || {},
      confidence_score: s.fusion_decision?.confidence_score || 0,
      confidence_level: s.fusion_decision?.confidence_level || 'unknown',
      explanation: s.fusion_decision?.explanation || '',
      status: 'pending',
      batch_number: s.batch_number,
      section_name: s.result?.merged_item?.section || 'Unknown',
      original_doc1_items: s.doc1_items || [],
      original_doc2_items: s.doc2_items || []
    }))

    const { data, error } = await supabase
      .from('fusion_suggestions')
      .insert(suggestionsData)
      .select()

    if (error) throw error
    console.log(`[Supabase] Saved ${data.length} fusion suggestions`)

    // Transform data to include doc1_items and doc2_items for UI compatibility
    const transformedData = data.map((item: any) => ({
      ...item,
      doc1_items: item.original_doc1_items || [],
      doc2_items: item.original_doc2_items || []
    }))

    return transformedData
  } catch (err) {
    console.error('[Supabase] Error saving suggestions:', err)
    return []
  }
}

/**
 * Update fusion suggestion status
 */
export async function updateFusionSuggestionStatus(
  fusionId: string,
  status: 'accepted' | 'rejected' | 'edited',
  editedItem?: any,
  editNotes?: string
): Promise<boolean> {
  try {
    const updates: any = {
      status,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (editedItem) updates.edited_item = editedItem
    if (editNotes) updates.edit_notes = editNotes

    const { error } = await supabase
      .from('fusion_suggestions')
      .update(updates)
      .eq('fusion_id', fusionId)

    if (error) throw error
    console.log(`[Supabase] Updated fusion ${fusionId} to ${status}`)
    return true
  } catch (err) {
    console.error('[Supabase] Error updating suggestion:', err)
    return false
  }
}

/**
 * Get fusion suggestions for a session
 */
export async function getFusionSuggestions(sessionId: string): Promise<FusionSuggestion[]> {
  try {
    const { data, error } = await supabase
      .from('fusion_suggestions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    console.log(`[Supabase] Retrieved ${data.length} suggestions for session`)

    // Transform data to include doc1_items and doc2_items for UI compatibility
    const transformedData = data.map((item: any) => ({
      ...item,
      doc1_items: item.original_doc1_items || [],
      doc2_items: item.original_doc2_items || []
    }))

    return transformedData
  } catch (err) {
    console.error('[Supabase] Error getting suggestions:', err)
    return []
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('fusion_suggestions')
      .select('status, confidence_score')
      .eq('session_id', sessionId)

    if (error) throw error

    const stats = {
      total: data.length,
      accepted: data.filter(s => s.status === 'accepted').length,
      rejected: data.filter(s => s.status === 'rejected').length,
      edited: data.filter(s => s.status === 'edited').length,
      pending: data.filter(s => s.status === 'pending').length,
      avgConfidence: data.length > 0
        ? Math.round(data.reduce((sum, s) => sum + s.confidence_score, 0) / data.length)
        : 0,
      highConfidence: data.filter(s => s.confidence_score >= 90).length,
      mediumConfidence: data.filter(s => s.confidence_score >= 70 && s.confidence_score < 90).length
    }

    return stats
  } catch (err) {
    console.error('[Supabase] Error getting stats:', err)
    return null
  }
}

/**
 * Get recent sessions (for session history/resume)
 */
export async function getRecentSessions(limit: number = 10): Promise<FusionSession[]> {
  try {
    const { data, error } = await supabase
      .from('fusion_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  } catch (err) {
    console.error('[Supabase] Error getting recent sessions:', err)
    return []
  }
}
