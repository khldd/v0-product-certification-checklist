/**
 * Auto-Fusion Hook (Lightweight, No Persistence)
 *
 * NOTE: For production use with Supabase persistence, use `useFusionSession` instead!
 *
 * This hook provides basic auto-fusion functionality without database persistence.
 * Use this for:
 * - Quick testing without Supabase setup
 * - Temporary sessions (no resume capability)
 * - Simpler integration (no session management)
 *
 * For production with:
 * - Document caching (same PDF = reuse parsing)
 * - Session persistence (pause/resume)
 * - Audit trail and analytics
 * → Use `useFusionSession` from `./useFusionSession.ts`
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

// Use local API proxy to avoid CORS issues
const AUTO_FUSION_API_URL = "/api/auto-fusion"

export interface AutoFusionResult {
  fusion_id: string
  batch_number: number
  timestamp: string
  fusion_decision: {
    can_fuse: boolean
    confidence_score: number
    confidence_level: string
    should_auto_apply: boolean
    explanation: string
  }
  result: {
    status: string
    merged_item: any | null
    action: string
  }
  doc1_items: any[]
  doc2_items: any[]
  metadata?: any
}

export interface AutoFusionSummary {
  total_pairs_analyzed: number
  fusions_found: number
  average_confidence: number
  confidence_breakdown: {
    very_high_90_plus: number
    high_75_to_89: number
    medium_70_to_74: number
  }
  sections_count?: number
  processing_timestamp: string
}

export interface AutoFusionResponse {
  success: boolean
  auto_fusions: AutoFusionResult[]
  summary: AutoFusionSummary
  sections_breakdown?: any[]
}

export function useAutoFusion() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [autoFusions, setAutoFusions] = useState<AutoFusionResult[]>([])
  const [summary, setSummary] = useState<AutoFusionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usedItemIds, setUsedItemIds] = useState<Set<string>>(new Set())

  /**
   * Start auto-fusion analysis
   */
  const startAutoFusion = useCallback(async (
    doc1Items: any[],
    doc2Items: any[]
  ): Promise<AutoFusionResponse | null> => {
    if (!doc1Items.length || !doc2Items.length) {
      setError("Both documents must have items to analyze")
      toast.error("Both documents must have items to analyze")
      return null
    }

    setIsAnalyzing(true)
    setError(null)
    setAutoFusions([])
    setSummary(null)

    console.log(`[Auto-Fusion] Starting analysis of ${doc1Items.length} + ${doc2Items.length} items`)
    toast.info(`Analyzing ${doc1Items.length + doc2Items.length} items with AI...`)

    try {
      const response = await fetch(AUTO_FUSION_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          doc1_all_items: doc1Items,
          doc2_all_items: doc2Items
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: AutoFusionResponse = await response.json()

      console.log(`[Auto-Fusion] Received ${data.auto_fusions?.length || 0} fusion suggestions`)
      console.log(`[Auto-Fusion] Summary:`, data.summary)

      // Store results - ensure doc1_items and doc2_items exist
      const validatedFusions = (data.auto_fusions || []).map(fusion => ({
        ...fusion,
        doc1_items: fusion.doc1_items || [],
        doc2_items: fusion.doc2_items || []
      }))
      setAutoFusions(validatedFusions)
      setSummary(data.summary || null)

      // Track used item IDs
      const used = new Set<string>()
      validatedFusions.forEach(fusion => {
        fusion.doc1_items.forEach((item: any) => {
          if (item?.id) used.add(item.id)
        })
        fusion.doc2_items.forEach((item: any) => {
          if (item?.id) used.add(item.id)
        })
      })
      setUsedItemIds(used)

      // Show success notification
      if (data.auto_fusions && data.auto_fusions.length > 0) {
        toast.success(`Found ${data.auto_fusions.length} high-confidence fusions! (${data.summary?.average_confidence || 0}% avg)`)
      } else {
        toast.warning("No high-confidence fusions found. Try manual fusion.")
      }

      return data

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to analyze items"
      setError(errorMsg)
      console.error("[Auto-Fusion] Error:", err)
      toast.error(`Auto-fusion failed: ${errorMsg}`)
      return null

    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  /**
   * Mark a fusion as accepted (adds used item IDs to tracking)
   */
  const acceptFusion = useCallback((fusion: AutoFusionResult) => {
    const newUsed = new Set(usedItemIds)

    fusion.doc1_items.forEach((item: any) => {
      if (item.id) newUsed.add(item.id)
    })
    fusion.doc2_items.forEach((item: any) => {
      if (item.id) newUsed.add(item.id)
    })

    setUsedItemIds(newUsed)
    console.log(`[Auto-Fusion] Accepted fusion ${fusion.fusion_id}, tracking ${newUsed.size} used items`)
  }, [usedItemIds])

  /**
   * Mark a fusion as rejected (removes used item IDs from tracking)
   */
  const rejectFusion = useCallback((fusion: AutoFusionResult) => {
    const newUsed = new Set(usedItemIds)

    fusion.doc1_items.forEach((item: any) => {
      if (item.id) newUsed.delete(item.id)
    })
    fusion.doc2_items.forEach((item: any) => {
      if (item.id) newUsed.delete(item.id)
    })

    setUsedItemIds(newUsed)
    console.log(`[Auto-Fusion] Rejected fusion ${fusion.fusion_id}, ${newUsed.size} items still used`)
  }, [usedItemIds])

  /**
   * Check if an item has been used in a fusion
   */
  const isItemUsed = useCallback((itemId: string): boolean => {
    return usedItemIds.has(itemId)
  }, [usedItemIds])

  /**
   * Get unused items from a checklist
   */
  const getUnusedItems = useCallback((items: any[]): any[] => {
    return items.filter(item => !isItemUsed(item.id))
  }, [isItemUsed])

  /**
   * Reset auto-fusion state
   */
  const reset = useCallback(() => {
    setAutoFusions([])
    setSummary(null)
    setError(null)
    setUsedItemIds(new Set())
    setIsAnalyzing(false)
  }, [])

  /**
   * Manually mark items as used (for manual fusions)
   */
  const markItemsUsed = useCallback((itemIds: string[]) => {
    const newUsed = new Set(usedItemIds)
    itemIds.forEach(id => newUsed.add(id))
    setUsedItemIds(newUsed)
    console.log(`[Auto-Fusion] Manually marked ${itemIds.length} items as used`)
  }, [usedItemIds])

  /**
   * Manually mark items as unused (for unfusing)
   */
  const markItemsUnused = useCallback((itemIds: string[]) => {
    const newUsed = new Set(usedItemIds)
    itemIds.forEach(id => newUsed.delete(id))
    setUsedItemIds(newUsed)
    console.log(`[Auto-Fusion] Unmarked ${itemIds.length} items`)
  }, [usedItemIds])

  return {
    // State
    isAnalyzing,
    autoFusions,
    summary,
    error,
    usedItemIds,

    // Actions
    startAutoFusion,
    acceptFusion,
    rejectFusion,
    isItemUsed,
    getUnusedItems,
    reset,
    markItemsUsed,
    markItemsUnused
  }
}
