/**
 * Fusion Session Hook
 *
 * Manages complete fusion workflow with Supabase persistence:
 * - Document caching (reuse parsed PDFs)
 * - Session creation and management
 * - Fusion suggestions storage and updates
 * - Progress tracking
 */

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  saveParsedDocument,
  findDocumentByHash,
  createFusionSession,
  updateFusionSession,
  getFusionSession,
  findSessionByDocuments,
  saveFusionSuggestions,
  updateFusionSuggestion,
  getSessionSuggestions,
  calculateFileHash,
  flattenChecklistSections,
  type ParsedDocument,
  type FusionSession,
  type FusionSuggestion
} from '@/lib/database-fusion'

export interface UseFusionSessionOptions {
  autoFusionWebhookUrl?: string
}

export interface FusionSessionData {
  session?: FusionSession
  doc1?: ParsedDocument
  doc2?: ParsedDocument
  suggestions: FusionSuggestion[]
  pendingSuggestions: FusionSuggestion[]
  acceptedSuggestions: FusionSuggestion[]
  rejectedSuggestions: FusionSuggestion[]
  isLoading: boolean
  error: string | null
}

export function useFusionSession(options: UseFusionSessionOptions = {}) {
  const {
    autoFusionWebhookUrl = process.env.NEXT_PUBLIC_AUTO_FUSION_WEBHOOK_URL || ''
  } = options

  // State
  const [sessionData, setSessionData] = useState<FusionSessionData>({
    suggestions: [],
    pendingSuggestions: [],
    acceptedSuggestions: [],
    rejectedSuggestions: [],
    isLoading: false,
    error: null
  })

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  // =====================================================
  // DOCUMENT MANAGEMENT
  // =====================================================

  /**
   * Save or retrieve cached document
   */
  const saveDocument = useCallback(async (
    file: File,
    parsedData: any
  ): Promise<ParsedDocument | null> => {
    try {
      setSessionData(prev => ({ ...prev, isLoading: true, error: null }))

      // Calculate file hash
      const fileHash = await calculateFileHash(file)
      console.log('[useFusionSession] File hash:', fileHash)

      // Check if document already exists
      const existingDoc = await findDocumentByHash(fileHash)
      if (existingDoc.success && existingDoc.data) {
        console.log('[useFusionSession] Found cached document:', existingDoc.data.id)
        toast.success('Document loaded from cache!')
        return existingDoc.data
      }

      // Save new document
      const newDoc: ParsedDocument = {
        file_name: file.name,
        file_hash: fileHash,
        file_size_bytes: file.size,
        document_metadata: parsedData[0]?.document || {},
        sections: parsedData[0]?.sections || parsedData,
        total_items: countItems(parsedData),
        total_sections: parsedData[0]?.sections?.length || 0
      }

      const saveResult = await saveParsedDocument(newDoc)
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save document')
      }

      console.log('[useFusionSession] Saved new document:', saveResult.data?.id)
      return saveResult.data || null

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save document'
      console.error('[useFusionSession] Save document error:', err)
      setSessionData(prev => ({ ...prev, error: errorMsg }))
      toast.error(errorMsg)
      return null
    } finally {
      setSessionData(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  /**
   * Count total items in parsed data
   */
  function countItems(parsedData: any): number {
    if (!parsedData || !Array.isArray(parsedData)) return 0
    let count = 0
    for (const doc of parsedData) {
      const sections = doc.sections || []
      for (const section of sections) {
        count += section.items?.length || 0
      }
    }
    return count
  }

  // =====================================================
  // SESSION MANAGEMENT
  // =====================================================

  /**
   * Create new fusion session
   */
  const createSession = useCallback(async (
    doc1Id: string,
    doc2Id: string,
    sessionName?: string
  ): Promise<FusionSession | null> => {
    try {
      setSessionData(prev => ({ ...prev, isLoading: true, error: null }))

      // Check if session already exists for these documents
      const existingSession = await findSessionByDocuments(doc1Id, doc2Id)
      if (existingSession.success && existingSession.data) {
        console.log('[useFusionSession] Found existing session:', existingSession.data.id)
        toast.info('Resuming existing session')

        // Load suggestions for this session
        const suggestionsResult = await getSessionSuggestions(existingSession.data.id)
        if (suggestionsResult.success && suggestionsResult.data) {
          const suggestions = suggestionsResult.data
          setSessionData(prev => ({
            ...prev,
            session: existingSession.data,
            suggestions,
            pendingSuggestions: suggestions.filter(s => s.status === 'pending'),
            acceptedSuggestions: suggestions.filter(s => s.status === 'accepted'),
            rejectedSuggestions: suggestions.filter(s => s.status === 'rejected')
          }))
        }

        return existingSession.data
      }

      // Create new session
      const newSession: FusionSession = {
        doc1_id: doc1Id,
        doc2_id: doc2Id,
        session_name: sessionName || `Session ${new Date().toLocaleDateString()}`,
        status: 'created',
        workflow_version: 'v1'
      }

      const result = await createFusionSession(newSession)
      if (!result.success) {
        throw new Error(result.error || 'Failed to create session')
      }

      console.log('[useFusionSession] Created new session:', result.data?.id)
      setSessionData(prev => ({
        ...prev,
        session: result.data,
        suggestions: [],
        pendingSuggestions: [],
        acceptedSuggestions: [],
        rejectedSuggestions: []
      }))

      return result.data || null

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create session'
      console.error('[useFusionSession] Create session error:', err)
      setSessionData(prev => ({ ...prev, error: errorMsg }))
      toast.error(errorMsg)
      return null
    } finally {
      setSessionData(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  /**
   * Update session status
   */
  const updateSessionStatus = useCallback(async (
    sessionId: string,
    status: FusionSession['status'],
    additionalUpdates?: Partial<FusionSession>
  ) => {
    try {
      const updates: Partial<FusionSession> = {
        status,
        ...additionalUpdates
      }

      if (status === 'analyzing') {
        updates.analysis_started_at = new Date().toISOString()
      } else if (status === 'ready') {
        updates.analysis_completed_at = new Date().toISOString()
      } else if (status === 'completed') {
        updates.completed_at = new Date().toISOString()
      }

      const result = await updateFusionSession(sessionId, updates)
      if (result.success && result.data) {
        setSessionData(prev => ({
          ...prev,
          session: result.data
        }))
      }

    } catch (err) {
      console.error('[useFusionSession] Update session status error:', err)
    }
  }, [])

  // =====================================================
  // AUTO-FUSION ANALYSIS
  // =====================================================

  /**
   * Start auto-fusion analysis
   */
  const startAutoFusion = useCallback(async (
    doc1Data: ParsedDocument,
    doc2Data: ParsedDocument,
    sessionId: string
  ): Promise<boolean> => {
    if (!autoFusionWebhookUrl) {
      toast.error('Auto-fusion webhook URL not configured')
      return false
    }

    try {
      setIsAnalyzing(true)
      setAnalysisProgress(0)

      await updateSessionStatus(sessionId, 'analyzing')

      // Flatten documents for analysis
      const doc1Items = flattenChecklistSections(doc1Data.sections)
      const doc2Items = flattenChecklistSections(doc2Data.sections)

      console.log('[useFusionSession] Starting auto-fusion:', {
        doc1Items: doc1Items.length,
        doc2Items: doc2Items.length
      })

      setAnalysisProgress(10)

      // Call n8n webhook
      const response = await fetch(autoFusionWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc1_all_items: [{ sections: doc1Data.sections }],
          doc2_all_items: [{ sections: doc2Data.sections }],
          session_id: sessionId
        })
      })

      setAnalysisProgress(80)

      if (!response.ok) {
        throw new Error(`Auto-fusion failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[useFusionSession] Auto-fusion completed:', result.summary)

      setAnalysisProgress(90)

      // Save suggestions to database
      if (result.auto_fusions && result.auto_fusions.length > 0) {
        const suggestions: FusionSuggestion[] = result.auto_fusions.map((fusion: any) => ({
          session_id: sessionId,
          fusion_id: fusion.fusion_id,
          doc1_id: doc1Data.id!,
          doc2_id: doc2Data.id!,
          doc1_item_ids: fusion.doc1_items.map((item: any) => item.id),
          doc2_item_ids: fusion.doc2_items.map((item: any) => item.id),
          merged_item: fusion.result.merged_item,
          confidence_score: fusion.fusion_decision.confidence_score,
          confidence_level: fusion.fusion_decision.confidence_level,
          explanation: fusion.fusion_decision.explanation,
          status: 'pending'
        }))

        const saveResult = await saveFusionSuggestions(suggestions)
        if (saveResult.success && saveResult.data) {
          setSessionData(prev => ({
            ...prev,
            suggestions: saveResult.data || [],
            pendingSuggestions: saveResult.data || []
          }))

          await updateSessionStatus(sessionId, 'ready', {
            total_pairs_analyzed: result.summary.total_pairs_analyzed,
            total_suggestions: suggestions.length,
            pending_count: suggestions.length,
            avg_confidence: result.summary.avg_confidence
          })

          setAnalysisProgress(100)
          toast.success(`Found ${suggestions.length} fusion suggestions!`)
          return true
        }
      } else {
        toast.info('No high-confidence fusions found')
        await updateSessionStatus(sessionId, 'ready', {
          total_suggestions: 0
        })
      }

      return true

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Auto-fusion failed'
      console.error('[useFusionSession] Auto-fusion error:', err)
      setSessionData(prev => ({ ...prev, error: errorMsg }))
      toast.error(errorMsg)

      await updateSessionStatus(sessionId, 'created') // Revert status
      return false

    } finally {
      setIsAnalyzing(false)
      setAnalysisProgress(0)
    }
  }, [autoFusionWebhookUrl, updateSessionStatus])

  // =====================================================
  // SUGGESTION ACTIONS
  // =====================================================

  /**
   * Accept a fusion suggestion
   */
  const acceptSuggestion = useCallback(async (suggestionId: string) => {
    try {
      const result = await updateFusionSuggestion(suggestionId, {
        status: 'accepted',
        reviewed_at: new Date().toISOString()
      })

      if (result.success && result.data) {
        setSessionData(prev => {
          const updated = prev.suggestions.map(s =>
            s.id === suggestionId ? result.data! : s
          )
          return {
            ...prev,
            suggestions: updated,
            pendingSuggestions: updated.filter(s => s.status === 'pending'),
            acceptedSuggestions: updated.filter(s => s.status === 'accepted'),
            rejectedSuggestions: updated.filter(s => s.status === 'rejected')
          }
        })

        toast.success('Fusion accepted')
        return true
      }

      return false

    } catch (err) {
      console.error('[useFusionSession] Accept suggestion error:', err)
      toast.error('Failed to accept fusion')
      return false
    }
  }, [])

  /**
   * Reject a fusion suggestion
   */
  const rejectSuggestion = useCallback(async (suggestionId: string) => {
    try {
      const result = await updateFusionSuggestion(suggestionId, {
        status: 'rejected',
        reviewed_at: new Date().toISOString()
      })

      if (result.success && result.data) {
        setSessionData(prev => {
          const updated = prev.suggestions.map(s =>
            s.id === suggestionId ? result.data! : s
          )
          return {
            ...prev,
            suggestions: updated,
            pendingSuggestions: updated.filter(s => s.status === 'pending'),
            acceptedSuggestions: updated.filter(s => s.status === 'accepted'),
            rejectedSuggestions: updated.filter(s => s.status === 'rejected')
          }
        })

        toast.info('Fusion rejected')
        return true
      }

      return false

    } catch (err) {
      console.error('[useFusionSession] Reject suggestion error:', err)
      toast.error('Failed to reject fusion')
      return false
    }
  }, [])

  /**
   * Edit a fusion suggestion
   */
  const editSuggestion = useCallback(async (
    suggestionId: string,
    editedItem: any,
    editNotes?: string
  ) => {
    try {
      const result = await updateFusionSuggestion(suggestionId, {
        status: 'edited',
        edited_item: editedItem,
        edit_notes: editNotes,
        reviewed_at: new Date().toISOString()
      })

      if (result.success && result.data) {
        setSessionData(prev => {
          const updated = prev.suggestions.map(s =>
            s.id === suggestionId ? result.data! : s
          )
          return {
            ...prev,
            suggestions: updated,
            pendingSuggestions: updated.filter(s => s.status === 'pending'),
            acceptedSuggestions: updated.filter(s => s.status === 'accepted' || s.status === 'edited'),
            rejectedSuggestions: updated.filter(s => s.status === 'rejected')
          }
        })

        toast.success('Fusion updated')
        return true
      }

      return false

    } catch (err) {
      console.error('[useFusionSession] Edit suggestion error:', err)
      toast.error('Failed to edit fusion')
      return false
    }
  }, [])

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  /**
   * Get used item IDs (from accepted/edited suggestions)
   */
  const getUsedItemIds = useCallback((): Set<string> => {
    const usedIds = new Set<string>()

    sessionData.acceptedSuggestions.forEach(suggestion => {
      suggestion.doc1_item_ids.forEach(id => usedIds.add(id))
      suggestion.doc2_item_ids.forEach(id => usedIds.add(id))
    })

    return usedIds
  }, [sessionData.acceptedSuggestions])

  /**
   * Check if item is used in accepted fusion
   */
  const isItemUsed = useCallback((itemId: string): boolean => {
    return getUsedItemIds().has(itemId)
  }, [getUsedItemIds])

  return {
    // State
    sessionData,
    isAnalyzing,
    analysisProgress,

    // Document functions
    saveDocument,

    // Session functions
    createSession,
    updateSessionStatus,

    // Analysis functions
    startAutoFusion,

    // Suggestion functions
    acceptSuggestion,
    rejectSuggestion,
    editSuggestion,

    // Utility functions
    getUsedItemIds,
    isItemUsed
  }
}
