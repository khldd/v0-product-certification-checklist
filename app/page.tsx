"use client"

import { useState, useEffect } from "react"
import DocumentUploader from "@/components/document-uploader"
import PDFViewer from "@/components/pdf-viewer"
import ChecklistViewer from "@/components/checklist-viewer"
import FusedChecklistDisplay from "@/components/fused-checklist-display"
import FusionResultDisplay from "@/components/fusion-result-display"
import FusionResultsList from "@/components/fusion-results-list"
import ManualFusionEditor from "@/components/manual-fusion-editor"
import { BatchProgressIndicator } from "@/components/batch-progress-indicator"
import { parseChecklistText } from "@/lib/checklist-parser"
// Supabase caching removed for simplicity
import { useBatchFusion, type BatchFusionResult } from "@/hooks/useBatchFusion"
import { validateFusionResponse } from "@/lib/utils"
import { toast } from "sonner"
import { useAutoFusion, type AutoFusionResult } from "@/hooks/useAutoFusion"
import { Check, X, Edit2 } from "lucide-react"
import { exportChecklistToPDF } from "@/lib/pdf-export"
import {
  generateFileHash,
  saveParsedDocument,
  getParsedDocument,
  getOrCreateFusionSession,
  updateFusionSession,
  saveFusionSuggestions,
  updateFusionSuggestionStatus,
  getSessionStats
} from "@/lib/supabase-db"

// Transform webhook response to match display component format
function transformWebhookResponse(data: any) {
  if (!data.checklist_unifiee) return { sections: {}, subsections: {}, points_fusionnes: [] }

  // Create lookup map for fusion data by question text
  const fusionMapByQuestion: Record<string, any> = {}
  const fusionMapById: Record<string, any> = {}

  if (data.points_fusionnes) {
    data.points_fusionnes.forEach((fusion: any) => {
      // Handle both old and new formats
      let fusionQuestion = ""
      let fusionId = ""

      // New format: fusion_resultat is a string, target_id is separate
      if (typeof fusion.fusion_resultat === "string") {
        fusionQuestion = fusion.fusion_resultat
        fusionId = fusion.target_id || ""
      }
      // Old format: fusion_resultat is an object with question and id
      else if (fusion.fusion_resultat?.question) {
        fusionQuestion = fusion.fusion_resultat.question
        fusionId = fusion.fusion_resultat.id || ""
      }

      // Map by question text (most reliable)
      if (fusionQuestion) {
        fusionMapByQuestion[fusionQuestion] = fusion
      }

      // Map by ID (handle various ID formats)
      if (fusionId) {
        // Store with full ID
        fusionMapById[fusionId] = fusion
        
        // Also store with ID suffix (removing prefixes like "FUSION.fusion." or section prefixes)
        const idSuffix = fusionId.replace(/^FUSION\.fusion\./, "").replace(/^[a-z]\./i, "")
        fusionMapById[idSuffix] = fusion
      }
    })
  }

  // Group items by section and subsection
  const sections: Record<string, { subsections: Record<string, any[]> }> = {}

  data.checklist_unifiee.forEach((item: any) => {
    const sectionKey = item.section || "Other"
    const subsectionKey = item.sous_section || "General"

    if (!sections[sectionKey]) {
      sections[sectionKey] = { subsections: {} }
    }
    if (!sections[sectionKey].subsections[subsectionKey]) {
      sections[sectionKey].subsections[subsectionKey] = []
    }

    // Find fusion data for this item (try question match first, then ID match)
    let fusionData = fusionMapByQuestion[item.question]

    // If not found by question, try matching by ID suffix
    if (!fusionData) {
      // Try direct ID match
      fusionData = fusionMapById[item.id]

      // If still not found, try removing section prefix from item ID
      if (!fusionData) {
        const idParts = item.id.split(".")
        if (idParts.length > 2) {
          // Try matching without section prefix (e.g., "publicite_conforme..." without "D.publicite.")
          const shortId = idParts.slice(2).join(".")
          fusionData = fusionMapById[shortId]
        }
      }
    }

    // Extract original texts from all sources dynamically
    const originalTexts: Record<string, string> = {}

    if (fusionData?.equivalents) {
      fusionData.equivalents.forEach((eq: any) => {
        if (eq.source && eq.texte) {
          if (!originalTexts[eq.source]) {
            originalTexts[eq.source] = eq.texte
          } else {
            originalTexts[eq.source] += " ; " + eq.texte
          }
        }
      })
    }

    // If no fusion data but we have origines, try to find the original texts
    if (Object.keys(originalTexts).length === 0 && item.origine && item.origine.length > 0) {
      item.origine.forEach((source: string) => {
        originalTexts[source] = item.question
      })
    }

    // Debug log to see what's being extracted
    if (fusionData && Object.keys(originalTexts).length > 0) {
      console.log(`[v0] Item "${item.question.substring(0, 50)}..." has ${Object.keys(originalTexts).length} original texts:`, Object.keys(originalTexts))
    }

    sections[sectionKey].subsections[subsectionKey].push({
      id: item.id,
      question: item.question,
      sous_section: item.sous_section,
      origine: item.origine || [],
      selected: item.selected || "fusion",
      fused_text: item.question,
      original_texts: originalTexts,
      fusion_id: fusionData?.fusion_id,
      choices: fusionData?.choices || ["fusion", "keep_source_CH", "keep_source_BS", "keep_both"],
    })
  })

  return {
    sections,
    points_fusionnes: data.points_fusionnes || [],
    raw: data,
  }
}

export default function Home() {
  const [doc1File, setDoc1File] = useState<File | null>(null)
  const [doc2File, setDoc2File] = useState<File | null>(null)
  const [doc1Data, setDoc1Data] = useState<any>(null)
  const [doc2Data, setDoc2Data] = useState<any>(null)
  const [doc1Selected, setDoc1Selected] = useState<any[]>([])
  const [doc2Selected, setDoc2Selected] = useState<any[]>([])
  const [fusedData, setFusedData] = useState<any>(null)
  const [fusionResponse, setFusionResponse] = useState<any>(null)
  const [fusionResults, setFusionResults] = useState<any[]>([]) // Accumulated fusion results
  const [fusionStatus, setFusionStatus] = useState<Record<string, 'accepted' | 'rejected'>>({}) // Track status by fusion_id
  const [showManualEditor, setShowManualEditor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [doc1DbId, setDoc1DbId] = useState<string | null>(null)
  const [doc2DbId, setDoc2DbId] = useState<string | null>(null)
  const [doc1Hash, setDoc1Hash] = useState<string | null>(null)
  const [doc2Hash, setDoc2Hash] = useState<string | null>(null)

  // Batch fusion hook
  const {
    progress,
    batchResults,
    error: batchError,
    processBatchFusion,
    resetBatch,
    isProcessing
  } = useBatchFusion()

  // Auto-fusion hook (simple, no Supabase complexity)
  const {
    isAnalyzing: isAutoAnalyzing,
    autoFusions,
    summary: autoFusionSummary,
    startAutoFusion,
    acceptFusion,
    rejectFusion,
    isItemUsed,
    markItemsUsed
  } = useAutoFusion()

  // Handle batch results
  useEffect(() => {
    if (batchResults.length > 0 && progress.status === 'completed') {
      // Process batch results when completed
      batchResults.forEach((result: BatchFusionResult) => {
        if (result.success) {
          setFusionResponse(result)
        }
      })
    }
  }, [batchResults, progress.status])

  const handleDoc1Upload = (file: File) => {
    if (file.type === "application/pdf") {
      setDoc1File(file)
      setDoc1Data(null) // Reset analyzed data when new file is uploaded
      setError(null)
    } else {
      setError("Please upload a PDF file")
    }
  }

  const handleDoc2Upload = (file: File) => {
    if (file.type === "application/pdf") {
      setDoc2File(file)
      setDoc2Data(null) // Reset analyzed data when new file is uploaded
      setError(null)
    } else {
      setError("Please upload a PDF file")
    }
  }

  const handleAnalyzeDocuments = async () => {
    if (!doc1File || !doc2File) {
      setError("Both documents are required")
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      console.log("[v0] Analyzing documents...")
      console.log("[v0] File 1:", doc1File.name, doc1File.size, "bytes")
      console.log("[v0] File 2:", doc2File.name, doc2File.size, "bytes")

      // Generate file hashes for caching
      console.log("[v0] 🔍 Generating file hashes...")
      const hash1 = await generateFileHash(doc1File)
      const hash2 = await generateFileHash(doc2File)
      setDoc1Hash(hash1)
      setDoc2Hash(hash2)
      console.log("[v0] ✅ Hashes generated")

      // Variables to store parsed data
      let doc1ParsedSections: any = null
      let doc1ParsedItems: any[] = []
      let doc2ParsedSections: any = null
      let doc2ParsedItems: any[] = []
      let doc1DbDoc: any = null
      let doc2DbDoc: any = null

      // Check cache for doc1
      console.log("[v0] 💾 Checking cache for doc1...")
      const cachedDoc1 = await getParsedDocument(hash1)
      if (cachedDoc1) {
        console.log("[v0] ✅ Doc1 found in cache!")
        doc1ParsedSections = cachedDoc1.sections
        doc1DbDoc = cachedDoc1
        toast.success("Doc1 loaded from cache")

        // Flatten cached sections for display
        if (Array.isArray(doc1ParsedSections)) {
          doc1ParsedSections.forEach((section: any) => {
            if (section.items && section.items.length > 0) {
              section.items.forEach((item: any) => {
                doc1ParsedItems.push({
                  id: item.id,
                  section: `${section.letter}. ${section.title}`,
                  sous_section: item.subsection || "",
                  question: item.label,
                  status: item.status,
                  options: item.options,
                  notes: item.notes,
                  page: item.page
                })
              })
            }
          })
        }
      } else {
        // Parse doc1
        console.log("[v0] 🔧 Parsing doc1 with Workflow 1...")
        const formData1 = new FormData()
        formData1.append("data", doc1File)

        const response1 = await fetch("/api/parse-checklist", {
          method: "POST",
          body: formData1,
        })

        if (!response1.ok) {
          throw new Error(`Doc1 parsing failed: ${response1.status}`)
        }

        const rawData1 = await response1.json()
        console.log("[v0] Doc1 parsed successfully")

        if (rawData1 && rawData1.sections) {
          doc1ParsedSections = rawData1.sections

          // Flatten for display
          rawData1.sections.forEach((section: any) => {
            if (section.items && section.items.length > 0) {
              section.items.forEach((item: any) => {
                doc1ParsedItems.push({
                  id: item.id,
                  section: `${section.letter}. ${section.title}`,
                  sous_section: item.subsection || "",
                  question: item.label,
                  status: item.status,
                  options: item.options,
                  notes: item.notes,
                  page: item.page
                })
              })
            }
          })

          console.log("[v0] Doc1: Parsed", doc1ParsedItems.length, "items")

          // Save to database
          console.log("[v0] 💾 Saving doc1 to database...")
          doc1DbDoc = await saveParsedDocument(
            hash1,
            doc1File.name,
            doc1File.size,
            rawData1.sections,
            {
              title: rawData1.document?.title || "Document 1",
              document: rawData1.document
            }
          )
          if (doc1DbDoc) {
            toast.success("Doc1 saved to database")
          }
        } else {
          throw new Error("Doc1 has unexpected format")
        }
      }

      // Set doc1 data
      setDoc1Data({
        checklist_unifiee: doc1ParsedItems,
        metadata: {
          filename: doc1File.name,
          source: doc1DbDoc?.document_metadata?.title || "Document 1",
          document: doc1DbDoc?.document_metadata?.document
        }
      })
      if (doc1DbDoc) {
        setDoc1DbId(doc1DbDoc.id)
      }

      // Check cache for doc2
      console.log("[v0] 💾 Checking cache for doc2...")
      const cachedDoc2 = await getParsedDocument(hash2)
      if (cachedDoc2) {
        console.log("[v0] ✅ Doc2 found in cache!")
        doc2ParsedSections = cachedDoc2.sections
        doc2DbDoc = cachedDoc2
        toast.success("Doc2 loaded from cache")

        // Flatten cached sections for display
        if (Array.isArray(doc2ParsedSections)) {
          doc2ParsedSections.forEach((section: any) => {
            if (section.items && section.items.length > 0) {
              section.items.forEach((item: any) => {
                doc2ParsedItems.push({
                  id: item.id,
                  section: `${section.letter}. ${section.title}`,
                  sous_section: item.subsection || "",
                  question: item.label,
                  status: item.status,
                  options: item.options,
                  notes: item.notes,
                  page: item.page
                })
              })
            }
          })
        }
      } else {
        // Parse doc2
        console.log("[v0] 🔧 Parsing doc2 with Workflow 1...")
        const formData2 = new FormData()
        formData2.append("data", doc2File)

        const response2 = await fetch("/api/parse-checklist", {
          method: "POST",
          body: formData2,
        })

        if (!response2.ok) {
          throw new Error(`Doc2 parsing failed: ${response2.status}`)
        }

        const rawData2 = await response2.json()
        console.log("[v0] Doc2 parsed successfully")

        if (rawData2 && rawData2.sections) {
          doc2ParsedSections = rawData2.sections

          // Flatten for display
          rawData2.sections.forEach((section: any) => {
            if (section.items && section.items.length > 0) {
              section.items.forEach((item: any) => {
                doc2ParsedItems.push({
                  id: item.id,
                  section: `${section.letter}. ${section.title}`,
                  sous_section: item.subsection || "",
                  question: item.label,
                  status: item.status,
                  options: item.options,
                  notes: item.notes,
                  page: item.page
                })
              })
            }
          })

          console.log("[v0] Doc2: Parsed", doc2ParsedItems.length, "items")

          // Save to database
          console.log("[v0] 💾 Saving doc2 to database...")
          doc2DbDoc = await saveParsedDocument(
            hash2,
            doc2File.name,
            doc2File.size,
            rawData2.sections,
            {
              title: rawData2.document?.title || "Document 2",
              document: rawData2.document
            }
          )
          if (doc2DbDoc) {
            toast.success("Doc2 saved to database")
          }
        } else {
          throw new Error("Doc2 has unexpected format")
        }
      }

      // Set doc2 data
      setDoc2Data({
        checklist_unifiee: doc2ParsedItems,
        metadata: {
          filename: doc2File.name,
          source: doc2DbDoc?.document_metadata?.title || "Document 2",
          document: doc2DbDoc?.document_metadata?.document
        }
      })
      if (doc2DbDoc) {
        setDoc2DbId(doc2DbDoc.id)
      }

      // NOW trigger auto-fusion with the parsed data
      console.log("[v0] ✅ Both documents parsed successfully")
      console.log("[v0] 🚀 Starting auto-fusion analysis...")
      toast.info("Starting AI fusion analysis...")

      // Get or create fusion session in database
      if (doc1DbDoc && doc2DbDoc) {
        console.log("[v0] 📝 Getting or creating fusion session...")
        const session = await getOrCreateFusionSession(
          doc1DbDoc.id,
          doc2DbDoc.id,
          `Fusion: ${doc1File.name} + ${doc2File.name}`
        )
        if (session) {
          setCurrentSessionId(session.id)
          setDoc1DbId(doc1DbDoc.id)
          setDoc2DbId(doc2DbDoc.id)
          toast.success("Session ready")
        }
      }

      // Call Workflow 3 with sections format
      const fusionResponse = await startAutoFusion(
        [{ sections: doc1ParsedSections }],
        [{ sections: doc2ParsedSections }]
      )

      console.log("[v0] ✅ Auto-fusion completed!")

      // Save fusion suggestions to database
      if (fusionResponse && currentSessionId && doc1DbDoc && doc2DbDoc) {
        console.log("[v0] 💾 Saving fusion suggestions...")
        const savedSuggestions = await saveFusionSuggestions(
          currentSessionId,
          doc1DbDoc.id,
          doc2DbDoc.id,
          autoFusions
        )

        if (savedSuggestions.length > 0) {
          // Update session stats
          const stats = await getSessionStats(currentSessionId)
          if (stats) {
            await updateFusionSession(currentSessionId, {
              status: 'completed',
              total_pairs_analyzed: stats.total,
              total_suggestions: stats.total,
              pending_count: stats.pending,
              avg_confidence: stats.avgConfidence,
              high_confidence_count: stats.highConfidence,
              medium_confidence_count: stats.mediumConfidence,
              analysis_completed_at: new Date().toISOString()
            })
          }
          toast.success(`Saved ${savedSuggestions.length} suggestions to database`)
        }
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to analyze documents"
      setError(errorMsg)
      console.error("[v0] Analysis error:", err)
      toast.error(errorMsg)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFuse = async () => {
    if (!doc1Selected.length || !doc2Selected.length) {
      setError("Please select items from both documents")
      toast.error("Please select items from both documents")
      return
    }

    setLoading(true)
    setError(null)
    resetBatch() // Clear any previous batch state

    try {
      console.log("[v0] Fusing selected items...")
      console.log("[v0] Doc1 selected items:", doc1Selected.length)
      console.log("[v0] Doc2 selected items:", doc2Selected.length)

      // Use batch fusion hook to process
      const results = await processBatchFusion(doc1Selected, doc2Selected)

      // Validate the response
      if (results.length > 0) {
        const firstResult = results[0]
        const validation = validateFusionResponse(firstResult)

        if (!validation.isValid) {
          console.error("[v0] Validation errors:", validation.errors)
          setError("Invalid response from fusion service: " + validation.errors.join(", "))
          toast.error("Validation failed: " + validation.errors[0])
          return
        }

        if (validation.warnings.length > 0) {
          console.warn("[v0] Validation warnings:", validation.warnings)
          validation.warnings.forEach(warning => {
            toast.warning(warning)
          })
        }

        // Check if this is the new fusion_decision format (Workflow 2)
        if (firstResult.fusion_decision) {
          // New format with fusion_decision
          console.log("[v0] Workflow 2 fusion format detected")
          console.log("[v0] Confidence:", firstResult.fusion_decision.confidence_score + "%")
          console.log("[v0] Can fuse:", firstResult.fusion_decision.can_fuse)

          // If fusion is recommended and user accepts, add to results
          if (firstResult.fusion_decision.can_fuse && firstResult.result.merged_item) {
            // Auto-add to fusion results in compatible format
            const newResult = {
              type: 'ai_fused',
              timestamp: new Date().toISOString(),
              fusion_id: `manual_${Date.now()}`,
              doc1_items: doc1Selected,
              doc2_items: doc2Selected,
              merged_item: firstResult.result.merged_item,
              decision: 'ai_fused',
              confidence: firstResult.fusion_decision.confidence_score,
              confidence_level: firstResult.fusion_decision.confidence_level,
              explanation: firstResult.fusion_decision.explanation
            }

            setFusionResults(prev => [...prev, newResult])

            // Mark items as used
            const itemIds = [
              ...doc1Selected.map((item: any) => item.id),
              ...doc2Selected.map((item: any) => item.id)
            ]
            markItemsUsed(itemIds)

            // Clear selections
            setDoc1Selected([])
            setDoc2Selected([])

            toast.success('Manual fusion added!')
          } else {
            // Show for review but don't auto-add - FIXED: Attach source items
            setFusionResponse({
              ...firstResult,
              doc1_items: doc1Selected,
              doc2_items: doc2Selected
            })
            setFusedData(null)
            toast.info('Analysis complete!')
          }
        } else {
          // Old format - transform as before
          console.log("[v0] Old fusion format detected, transforming...")
          const transformedData = transformWebhookResponse(firstResult)
          console.log("[v0] Transformed data:", transformedData)
          setFusedData(transformedData)
          setFusionResponse(null) // Clear fusionResponse
          toast.success("Fusion complete!")
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fuse documents. Check webhook URL and CORS settings."
      setError(errorMsg)
      console.error("[v0] Fuse error:", err)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleManualFuse = () => {
    setShowManualEditor(true)
  }

  const handleSaveManualFusion = async (mergedItem: any) => {
    console.log("[v0] Manual fusion saved:", mergedItem)

    // Check if this is editing an existing auto-fusion
    const isEditingAutoFusion = fusionResponse?.fusion_id

    // Add to fusion results array
    const newResult = {
      type: isEditingAutoFusion ? 'edited' : 'manual',
      timestamp: new Date().toISOString(),
      fusion_id: isEditingAutoFusion || `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      doc1_items: doc1Selected,
      doc2_items: doc2Selected,
      merged_item: mergedItem,
      decision: isEditingAutoFusion ? 'edited' : 'manually_fused'
    }

    setFusionResults(prev => [...prev, newResult])

    // Save to database
    if (currentSessionId && doc1DbId && doc2DbId) {
      if (isEditingAutoFusion) {
        // Update existing fusion with edited item
        const updated = await updateFusionSuggestionStatus(
          fusionResponse.fusion_id,
          'edited',
          mergedItem,
          'User edited auto-fusion suggestion'
        )
        if (updated) {
          console.log("[v0] Saved edited fusion to database")
        }
      } else {
        // Save new manual fusion
        const saved = await saveFusionSuggestions(
          currentSessionId,
          doc1DbId,
          doc2DbId,
          [newResult]
        )
        if (saved.length > 0) {
          console.log("[v0] Saved manual fusion to database")
        }
      }

      // Update session stats
      const stats = await getSessionStats(currentSessionId)
      if (stats) {
        await updateFusionSession(currentSessionId, {
          accepted_count: stats.accepted,
          rejected_count: stats.rejected,
          edited_count: stats.edited,
          pending_count: stats.pending,
          total_suggestions: stats.total
        })
      }
    }

    // Clear current fusion response and close editor
    setShowManualEditor(false)
    setFusionResponse(null)

    // Clear selections so user can select next items
    setDoc1Selected([])
    setDoc2Selected([])

    toast.success(isEditingAutoFusion ? "Fusion edited and saved" : "Manual fusion created and saved")
  }

  const handleKeepSeparate = () => {
    console.log("[v0] Keeping items separate")
    
    // Add both items to fusion results as separate entries
    const newResult = {
      type: 'kept_separate',
      timestamp: new Date().toISOString(),
      doc1_items: doc1Selected,
      doc2_items: doc2Selected,
      decision: 'kept_separate',
      reason: fusionResponse?.fusion_decision?.explanation || 'User chose to keep items separate'
    }
    
    setFusionResults(prev => [...prev, newResult])
    
    // Clear current fusion response
    setFusionResponse(null)
    
    // Clear selections so user can select next items
    setDoc1Selected([])
    setDoc2Selected([])
  }

  const handleAcceptFusion = () => {
    console.log("[v0] Accepting AI fusion")
    
    // Add to fusion results array
    const newResult = {
      type: 'ai_fused',
      timestamp: new Date().toISOString(),
      doc1_items: doc1Selected,
      doc2_items: doc2Selected,
      merged_item: fusionResponse.result.merged_item,
      decision: 'ai_fused',
      confidence: fusionResponse.fusion_decision.confidence_score,
      confidence_level: fusionResponse.fusion_decision.confidence_level
    }
    
    setFusionResults(prev => [...prev, newResult])
    
    // Clear current fusion response
    setFusionResponse(null)
    
    // Clear selections so user can select next items
    setDoc1Selected([])
    setDoc2Selected([])
  }

  const handleClearResults = () => {
    setFusionResults([])
    setFusionResponse(null)
  }

  // Handlers for auto-fusion suggestions
  const handleAcceptAutoFusion = async (fusion: AutoFusionResult) => {
    console.log("[v0] Accepting auto-fusion:", fusion.fusion_id)

    // Check if already accepted
    if (fusionStatus[fusion.fusion_id] === 'accepted') {
      toast.warning("This fusion is already accepted")
      return
    }

    // Mark as accepted
    acceptFusion(fusion)
    setFusionStatus(prev => ({ ...prev, [fusion.fusion_id]: 'accepted' }))

    // Update status in database
    const updated = await updateFusionSuggestionStatus(fusion.fusion_id, 'accepted')
    if (updated && currentSessionId) {
      // Update session stats
      const stats = await getSessionStats(currentSessionId)
      if (stats) {
        await updateFusionSession(currentSessionId, {
          accepted_count: stats.accepted,
          rejected_count: stats.rejected,
          edited_count: stats.edited,
          pending_count: stats.pending
        })
      }
    }

    // Add to final results
    const newResult = {
      type: 'ai_fused',
      timestamp: new Date().toISOString(),
      fusion_id: fusion.fusion_id,
      doc1_items: fusion.doc1_items,
      doc2_items: fusion.doc2_items,
      merged_item: fusion.result.merged_item,
      decision: 'ai_fused',
      confidence: fusion.fusion_decision.confidence_score,
      confidence_level: fusion.fusion_decision.confidence_level,
      explanation: fusion.fusion_decision.explanation
    }

    setFusionResults(prev => [...prev, newResult])

    // Track items as used
    const itemIds = [
      ...fusion.doc1_items.map((item: any) => item.id),
      ...fusion.doc2_items.map((item: any) => item.id)
    ]
    markItemsUsed(itemIds)

    toast.success("Fusion accepted and saved")
  }

  const handleRejectAutoFusion = async (fusion: AutoFusionResult) => {
    console.log("[v0] Rejecting auto-fusion:", fusion.fusion_id)

    // Mark as rejected
    rejectFusion(fusion)
    setFusionStatus(prev => ({ ...prev, [fusion.fusion_id]: 'rejected' }))

    // Update status in database
    const updated = await updateFusionSuggestionStatus(fusion.fusion_id, 'rejected')
    if (updated && currentSessionId) {
      // Update session stats
      const stats = await getSessionStats(currentSessionId)
      if (stats) {
        await updateFusionSession(currentSessionId, {
          accepted_count: stats.accepted,
          rejected_count: stats.rejected,
          edited_count: stats.edited,
          pending_count: stats.pending
        })
      }
    }

    toast.info("Fusion rejected and saved")
  }

  const handleUndoFusion = async (fusion: AutoFusionResult) => {
    console.log("[v0] Undoing fusion:", fusion.fusion_id)

    // Remove status
    setFusionStatus(prev => {
      const newStatus = { ...prev }
      delete newStatus[fusion.fusion_id]
      return newStatus
    })

    // Remove from results if it was accepted
    setFusionResults(prev => prev.filter(r => r.fusion_id !== fusion.fusion_id))

    // Unmark items as used
    const itemIds = [
      ...fusion.doc1_items.map((item: any) => item.id),
      ...fusion.doc2_items.map((item: any) => item.id)
    ]
    itemIds.forEach(id => {
      // Simple check - if item not used in other fusions, unmark it
      const usedInOther = fusionResults.some(r =>
        r.fusion_id !== fusion.fusion_id &&
        (r.doc1_items?.some((i: any) => i.id === id) || r.doc2_items?.some((i: any) => i.id === id))
      )
      if (!usedInOther) {
        // Would need to call markItemsUnused from useAutoFusion hook
      }
    })

    // Reset status in database back to pending
    const updated = await updateFusionSuggestionStatus(fusion.fusion_id, 'pending' as any)
    if (updated && currentSessionId) {
      // Update session stats
      const stats = await getSessionStats(currentSessionId)
      if (stats) {
        await updateFusionSession(currentSessionId, {
          accepted_count: stats.accepted,
          rejected_count: stats.rejected,
          edited_count: stats.edited,
          pending_count: stats.pending
        })
      }
    }

    toast.success("Fusion status reset and saved")
  }

  const handleEditAutoFusion = (fusion: AutoFusionResult) => {
    console.log("[v0] Editing auto-fusion:", fusion.fusion_id)

    // FIXED: Set the source items from the fusion object
    setDoc1Selected(fusion.doc1_items || [])
    setDoc2Selected(fusion.doc2_items || [])

    // Pre-populate editor with this fusion
    setShowManualEditor(true)
    setFusionResponse({
      fusion_decision: fusion.fusion_decision,
      result: fusion.result,
      fusion_id: fusion.fusion_id  // Preserve fusion_id for tracking edits
    })

    toast.info("Opening editor to customize fusion")
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-full px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Certification Checklist Fuser</h1>
            <p className="text-slate-600 text-sm">Upload two certification checklists and merge them with AI intelligence</p>
          </div>

          {/* PDF Export Button - Always visible in header when there's data */}
          {(doc1Data || doc2Data) && (
            <button
              onClick={async () => {
                try {
                  // Get accepted fusions
                  const acceptedItems = fusionResults.filter(r => fusionStatus[r.fusion_id] === 'accepted')

                  // Get rejected fusions (will be expanded to original items in PDF)
                  const rejectedItems = fusionResults.filter(r => fusionStatus[r.fusion_id] === 'rejected')

                  // Get unfused items from both documents (items not used in any fusion at all)
                  const usedItemIds = new Set<string>()
                  fusionResults.forEach(f => {
                    f.doc1_items?.forEach((item: any) => usedItemIds.add(item.id))
                    f.doc2_items?.forEach((item: any) => usedItemIds.add(item.id))
                  })

                  const doc1Unfused = doc1Data?.checklist_unifiee?.filter((item: any) =>
                    !usedItemIds.has(item.id)
                  ) || []
                  const doc2Unfused = doc2Data?.checklist_unifiee?.filter((item: any) =>
                    !usedItemIds.has(item.id)
                  ) || []

                  // Calculate total items (accepted merged items + rejected original items + unfused items)
                  const acceptedCount = acceptedItems.length
                  const rejectedCount = rejectedItems.reduce((sum, r) =>
                    sum + (r.doc1_items?.length || 0) + (r.doc2_items?.length || 0), 0
                  )
                  const unfusedCount = doc1Unfused.length + doc2Unfused.length
                  const totalItems = acceptedCount + rejectedCount + unfusedCount

                  if (totalItems === 0) {
                    toast.warning("No items to export. Accept or reject some fusions first!")
                    return
                  }

                  toast.info(`Generating PDF with ${totalItems} items (${acceptedCount} fusions, ${rejectedCount} rejected items, ${unfusedCount} unfused)...`)
                  console.log("[v0] Exporting:", { acceptedItems, rejectedItems, doc1Unfused, doc2Unfused })

                  // Export to PDF
                  await exportChecklistToPDF({
                    acceptedFusions: acceptedItems,
                    rejectedFusions: rejectedItems,
                    unfusedItems: [...doc1Unfused, ...doc2Unfused],
                    metadata: {
                      date: new Date().toLocaleDateString('fr-FR'),
                      company: doc1Data?.metadata?.filename || 'N/A',
                      auditor: 'N/A'
                    }
                  })

                  toast.success("PDF exported successfully!")
                } catch (err) {
                  console.error("[v0] PDF export error:", err)
                  toast.error("Failed to export PDF: " + (err instanceof Error ? err.message : 'Unknown error'))
                }
              }}
              disabled={fusionResults.length === 0 && !doc1Data && !doc2Data}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              title="Export final checklist as PDF"
            >
              📄 Export PDF
              {fusionResults.length > 0 && (
                <span className="px-2 py-0.5 bg-white text-indigo-600 rounded-full text-xs font-bold">
                  {fusionResults.filter(r => fusionStatus[r.fusion_id] === 'accepted').length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 mx-4 mt-2">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {/* Left Panel - Document 1 */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
              <h2 className="text-base font-semibold text-blue-900">Document 1</h2>
              <p className="text-xs text-blue-700">
                {doc1Data ? "Checklist extracted" : "Upload first checklist"}
              </p>
            </div>
            {!doc1File ? (
              <DocumentUploader onUpload={handleDoc1Upload} label="Drop PDF here" />
            ) : doc1Data ? (
              <ChecklistViewer 
                data={doc1Data} 
                onSelectionChange={setDoc1Selected}
                title="Checklist 1"
              />
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                <PDFViewer file={doc1File} />
              </div>
            )}
          </div>

          {/* Center Panel - Fused Checklist */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-green-50 border-b border-green-200 px-4 py-2">
              <h2 className="text-base font-semibold text-green-900">Fused Checklist</h2>
              <p className="text-xs text-green-700">
                {isAutoAnalyzing
                  ? "AI analyzing documents..."
                  : autoFusions.length > 0
                  ? `${autoFusions.length} AI suggestions • ${fusionResults.length} accepted`
                  : isProcessing
                  ? "Processing fusion..."
                  : fusionResponse
                  ? "Review current fusion"
                  : fusionResults.length > 0
                  ? `${fusionResults.length} fusion(s) saved`
                  : "AI-merged results"}
              </p>
            </div>

            {/* Auto-Fusion Analysis Progress */}
            {isAutoAnalyzing && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-slate-600 font-medium">AI Analyzing Documents...</p>
                  <p className="text-slate-400 text-sm mt-1">Finding fusion opportunities</p>
                </div>
              </div>
            )}

            {/* Auto-Fusion Suggestions (Simple Inline Display) */}
            {!isAutoAnalyzing && autoFusions.length > 0 && (
              <div className="flex-1 overflow-auto">
                <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
                  <h3 className="text-sm font-bold text-blue-900">
                    🤖 AI Fusion Suggestions ({autoFusions.length})
                  </h3>
                  <p className="text-xs text-blue-600">
                    Review and click Accept/Reject/Edit for each suggestion
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {autoFusions.map((fusion, index) => {
                    const status = fusionStatus[fusion.fusion_id]
                    const canFuse = fusion.fusion_decision.can_fuse
                    const doc1Item = fusion.doc1_items?.[0]
                    const doc2Item = fusion.doc2_items?.[0]

                    return (
                      <div key={fusion.fusion_id} className={`p-4 transition ${
                        status === 'accepted' ? 'bg-green-50' : status === 'rejected' ? 'bg-red-50' : 'hover:bg-slate-50'
                      }`}>
                        {/* AI Badge and Status */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 rounded-md text-xs font-semibold ${
                              canFuse ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              🤖 AI {canFuse ? 'Suggested Fusion' : 'Comparison (Not Fusable)'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === 'accepted' && (
                              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Accepted
                              </span>
                            )}
                            {status === 'rejected' && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-semibold flex items-center gap-1">
                                <X className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Doc1 Item */}
                        {doc1Item && (
                          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-blue-800">📄 Document 1</span>
                              <span className="text-xs text-blue-600">Page {doc1Item.page}</span>
                            </div>
                            <div className="text-xs text-blue-700 mb-1 font-medium">
                              [{doc1Item.section || 'No section'}]
                            </div>
                            <div className="text-sm text-slate-800 font-medium">
                              "{doc1Item.question || doc1Item.label || 'No question'}"
                            </div>
                          </div>
                        )}

                        {/* Doc2 Item */}
                        {doc2Item && (
                          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-red-800">📄 Document 2</span>
                              <span className="text-xs text-red-600">Page {doc2Item.page}</span>
                            </div>
                            <div className="text-xs text-red-700 mb-1 font-medium">
                              [{doc2Item.section || 'No section'}]
                            </div>
                            <div className="text-sm text-slate-800 font-medium">
                              "{doc2Item.question || doc2Item.label || 'No question'}"
                            </div>
                          </div>
                        )}

                        {/* Merged Result (for fusable items) */}
                        {canFuse && fusion.result.merged_item && (
                          <div className="mb-3 bg-green-50 border border-green-300 rounded-lg p-3">
                            <div className="text-xs font-semibold text-green-800 mb-1">✅ Merged Result:</div>
                            <div className="text-sm text-slate-800 font-semibold">
                              "{fusion.result.merged_item.question}"
                            </div>
                            {fusion.result.merged_item.section && (
                              <div className="text-xs text-green-700 mt-1">
                                {fusion.result.merged_item.section}
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Explanation */}
                        {fusion.fusion_decision.explanation && (
                          <div className="mb-3 bg-slate-50 border border-slate-200 rounded-lg p-2">
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold">ℹ️ AI Reasoning:</span> {fusion.fusion_decision.explanation}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          {!status && (
                            <>
                              <button
                                onClick={() => handleAcceptAutoFusion(fusion)}
                                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium flex items-center justify-center gap-1"
                                title="Accept this fusion"
                              >
                                <Check className="w-4 h-4" />
                                Accept
                              </button>
                              <button
                                onClick={() => handleEditAutoFusion(fusion)}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium flex items-center justify-center gap-1"
                                title="Edit this fusion"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleRejectAutoFusion(fusion)}
                                className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm font-medium flex items-center justify-center gap-1"
                                title="Reject and keep items separate"
                              >
                                <X className="w-4 h-4" />
                                Reject
                              </button>
                            </>
                          )}
                          {status && (
                            <button
                              onClick={() => handleUndoFusion(fusion)}
                              className="w-full px-3 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition text-sm font-medium"
                              title="Undo this action"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Current Manual Fusion Review */}
            {!isAutoAnalyzing && autoFusions.length === 0 && (isProcessing || progress.status === 'processing') ? (
              <BatchProgressIndicator progress={progress} />
            ) : !isAutoAnalyzing && autoFusions.length === 0 && fusionResponse ? (
              <FusionResultDisplay
                fusionResponse={fusionResponse}
                doc1Selected={doc1Selected}
                doc2Selected={doc2Selected}
                onAcceptFusion={handleAcceptFusion}
                onManualFuse={handleManualFuse}
                onKeepSeparate={handleKeepSeparate}
              />
            ) : !isAutoAnalyzing && autoFusions.length === 0 && fusionResults.length > 0 ? (
              <FusionResultsList
                results={fusionResults}
                onClear={handleClearResults}
              />
            ) : !isAutoAnalyzing && autoFusions.length === 0 && fusedData ? (
              <FusedChecklistDisplay data={fusedData} setFusedData={setFusedData} />
            ) : !isAutoAnalyzing && autoFusions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-slate-400 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">
                    {!doc1Data || !doc2Data ? "Analyze documents first" : "Select items and click Fuse"}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {!doc1Data || !doc2Data ? "Click 'Analyze Documents' button" : "AI will suggest fusions automatically"}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Panel - Document 2 */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-red-50 border-b border-red-200 px-4 py-2">
              <h2 className="text-base font-semibold text-red-900">Document 2</h2>
              <p className="text-xs text-red-700">
                {doc2Data ? "Checklist extracted" : "Upload second checklist"}
              </p>
            </div>
            {!doc2File ? (
              <DocumentUploader onUpload={handleDoc2Upload} label="Drop PDF here" />
            ) : doc2Data ? (
              <ChecklistViewer 
                data={doc2Data} 
                onSelectionChange={setDoc2Selected}
                title="Checklist 2"
              />
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                <PDFViewer file={doc2File} />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - SIMPLE ONE BUTTON WORKFLOW */}
        <div className="mt-3 flex justify-center gap-3 flex-wrap">
          {/* Main Button - Changes based on workflow state */}
          {!doc1Data || !doc2Data ? (
            // STEP 1: Analyze & Fuse Documents (ONE BUTTON)
            <button
              onClick={handleAnalyzeDocuments}
              disabled={!doc1File || !doc2File || analyzing}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
                !doc1File || !doc2File || analyzing
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
              }`}
            >
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analyzing & Fusing...
                </span>
              ) : (
                "🚀 Analyze & Fuse Documents"
              )}
            </button>
          ) : (
            // STEP 5: Fuse Selected Items (for leftovers)
            <button
              onClick={handleFuse}
              disabled={!doc1Selected.length || !doc2Selected.length || loading}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                !doc1Selected.length || !doc2Selected.length || loading
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Fusing...
                </span>
              ) : (
                `Fuse Selected Items (${doc1Selected.length} + ${doc2Selected.length})`
              )}
            </button>
          )}
        </div>
      </div>

      {/* Manual Fusion Editor Modal */}
      {showManualEditor && (
        <ManualFusionEditor
          doc1Items={doc1Selected}
          doc2Items={doc2Selected}
          suggestedMerge={fusionResponse?.result?.merged_item}
          onSave={handleSaveManualFusion}
          onCancel={() => setShowManualEditor(false)}
        />
      )}
    </main>
  )
}
