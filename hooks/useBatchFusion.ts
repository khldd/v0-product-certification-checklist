import { useState, useCallback } from 'react'

// Define a more flexible ChecklistItem type that works with both parsed and raw items
export interface ChecklistItem {
  id?: string
  section?: string
  sous_section?: string
  subsection?: string
  question?: string
  label?: string
  status?: string
  options?: any[]
  notes?: string | null
  page?: number
  [key: string]: any
}

export interface FusionPair {
  doc1_items: ChecklistItem[]
  doc2_items: ChecklistItem[]
}

export interface BatchFusionResult {
  success: boolean
  timestamp: string
  fusion_decision: {
    can_fuse: boolean
    confidence_score: number
    confidence_level: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
    should_auto_apply: boolean
    explanation: string
  }
  result: {
    status: 'fused' | 'not_fusable'
    merged_item?: any
    action: string
  }
  metadata?: {
    ai_agent: string
    processed_at: string
  }
  // Track which items from selection this result corresponds to
  source_pair: {
    doc1_items: ChecklistItem[]
    doc2_items: ChecklistItem[]
  }
}

export interface BatchProgress {
  current: number
  total: number
  status: 'idle' | 'processing' | 'completed' | 'error'
  currentOperation?: string
}

const FUSION_WEBHOOK_URL = "https://karim.n8nkk.tech/webhook/8a1abe39-1ef4-4ec9-b9ab-8915c4b38dd6"

export function useBatchFusion() {
  const [progress, setProgress] = useState<BatchProgress>({
    current: 0,
    total: 0,
    status: 'idle'
  })
  const [batchResults, setBatchResults] = useState<BatchFusionResult[]>([])
  const [error, setError] = useState<string | null>(null)

  /**
   * Process a single fusion request
   */
  const processSingleFusion = async (
    doc1Items: ChecklistItem[],
    doc2Items: ChecklistItem[]
  ): Promise<BatchFusionResult> => {
    const response = await fetch(FUSION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        doc1_items: doc1Items,
        doc2_items: doc2Items,
      }),
    })

    if (!response.ok) {
      throw new Error(`Fusion request failed: ${response.statusText}`)
    }

    const data = await response.json()

    // Add source tracking
    return {
      ...data,
      source_pair: {
        doc1_items: doc1Items,
        doc2_items: doc2Items
      }
    }
  }

  /**
   * Process batch fusion for current selections
   * Currently processes as a single request (as per n8n workflow)
   */
  const processBatchFusion = useCallback(async (
    doc1Selected: ChecklistItem[],
    doc2Selected: ChecklistItem[]
  ): Promise<BatchFusionResult[]> => {
    try {
      setError(null)
      setProgress({
        current: 0,
        total: 1,
        status: 'processing',
        currentOperation: 'Sending items to AI for analysis...'
      })

      // Process as a single fusion request (current workflow)
      const result = await processSingleFusion(doc1Selected, doc2Selected)

      setProgress({
        current: 1,
        total: 1,
        status: 'completed',
        currentOperation: 'Analysis complete'
      })

      setBatchResults([result])
      return [result]

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setProgress({
        current: 0,
        total: 0,
        status: 'error',
        currentOperation: errorMessage
      })
      throw err
    }
  }, [])

  /**
   * Reset batch state
   */
  const resetBatch = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      status: 'idle'
    })
    setBatchResults([])
    setError(null)
  }, [])

  /**
   * Clear specific result from batch results
   */
  const clearResult = useCallback((index: number) => {
    setBatchResults(prev => prev.filter((_, i) => i !== index))
  }, [])

  return {
    progress,
    batchResults,
    error,
    processBatchFusion,
    resetBatch,
    clearResult,
    isProcessing: progress.status === 'processing'
  }
}
