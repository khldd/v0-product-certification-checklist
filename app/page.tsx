"use client"

import { useState } from "react"
import DocumentUploader from "@/components/document-uploader"
import PDFViewer from "@/components/pdf-viewer"
import ChecklistViewer from "@/components/checklist-viewer"
import FuseButton from "@/components/fuse-button"
import FusedChecklistDisplay from "@/components/fused-checklist-display"
import FusionResultDisplay from "@/components/fusion-result-display"
import FusionResultsList from "@/components/fusion-results-list"
import ManualFusionEditor from "@/components/manual-fusion-editor"
import { parseChecklistText } from "@/lib/checklist-parser"
import { generateFileHash, getChecklistFromCache, saveChecklistToCache } from "@/lib/supabase"

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
  const [showManualEditor, setShowManualEditor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      console.log("[v0] Generating file hashes...")
      const doc1Hash = await generateFileHash(doc1File)
      const doc2Hash = await generateFileHash(doc2File)
      console.log("[v0] Doc1 hash:", doc1Hash.substring(0, 16) + "...")
      console.log("[v0] Doc2 hash:", doc2Hash.substring(0, 16) + "...")

      // Check cache for doc1
      console.log("[v0] Checking cache for doc1...")
      const cachedDoc1 = await getChecklistFromCache(doc1Hash)
      
      if (cachedDoc1) {
        console.log("[v0] ✅ Doc1 found in cache!")
        setDoc1Data({
          checklist_unifiee: cachedDoc1.checklist_data,
          metadata: cachedDoc1.metadata
        })
      } else {
        // Process doc1 with webhook
        console.log("[v0] ❌ Doc1 not in cache, sending to webhook...")
        const formData1 = new FormData()
        formData1.append("data", doc1File)

        const response1 = await fetch("https://karim.n8nkk.tech/webhook/2144abe8-5f30-4747-befe-5ac55487fe97", {
          method: "POST",
          body: formData1,
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        })

        if (!response1.ok) {
          throw new Error(`Doc1 webhook failed: ${response1.status}`)
        }

        const responseText1 = await response1.text()
        const rawData1 = responseText1 ? JSON.parse(responseText1) : {}
        console.log("[v0] Doc1 response length:", responseText1.length)
        
        // The webhook returns structured JSON - could be direct object or in sections
        if (rawData1 && rawData1.sections) {
          // Format 1: {"document": {...}, "sections": [...]}
          console.log("[v0] Doc1 document:", rawData1.document?.title)
          console.log("[v0] Doc1 sections:", rawData1.sections?.length)
          
          const checklist_unifiee: any[] = []
          
          rawData1.sections.forEach((section: any) => {
            if (section.items && section.items.length > 0) {
              section.items.forEach((item: any) => {
                checklist_unifiee.push({
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
          
          console.log("[v0] Parsed", checklist_unifiee.length, "items from doc1")
          
          const metadata = {
            filename: doc1File.name,
            source: rawData1.document?.title || "Document 1",
            document: rawData1.document
          }
          
          setDoc1Data({
            checklist_unifiee,
            metadata
          })
          
          // Save to cache
          console.log("[v0] Saving doc1 to cache...")
          await saveChecklistToCache(doc1Hash, doc1File.name, doc1File.size, checklist_unifiee, metadata)
        } else {
          console.error("[v0] Doc1 has unexpected structure or no sections")
        }
      }

      // Check cache for doc2
      console.log("[v0] Checking cache for doc2...")
      const cachedDoc2 = await getChecklistFromCache(doc2Hash)
      
      if (cachedDoc2) {
        console.log("[v0] ✅ Doc2 found in cache!")
        setDoc2Data({
          checklist_unifiee: cachedDoc2.checklist_data,
          metadata: cachedDoc2.metadata
        })
      } else {
        // Process doc2 with webhook
        console.log("[v0] ❌ Doc2 not in cache, sending to webhook...")
        const formData2 = new FormData()
        formData2.append("data", doc2File)

        const response2 = await fetch("https://karim.n8nkk.tech/webhook/2144abe8-5f30-4747-befe-5ac55487fe97", {
          method: "POST",
          body: formData2,
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        })

        if (!response2.ok) {
          throw new Error(`Doc2 webhook failed: ${response2.status}`)
        }

        const responseText2 = await response2.text()
        const rawData2 = responseText2 ? JSON.parse(responseText2) : {}
        console.log("[v0] Doc2 response length:", responseText2.length)

        // The webhook returns structured JSON - could be direct checklist_unifiee or sections format
        if (rawData2 && rawData2.checklist_unifiee) {
          // Format 2: {"checklist_unifiee": [...]}
          console.log("[v0] Doc2 items:", rawData2.checklist_unifiee.length)
          
          const metadata = {
            filename: doc2File.name,
            source: "Document 2"
          }
          
          setDoc2Data({
            checklist_unifiee: rawData2.checklist_unifiee,
            metadata
          })
          
          console.log("[v0] Loaded", rawData2.checklist_unifiee.length, "items from doc2")
          
          // Save to cache
          console.log("[v0] Saving doc2 to cache...")
          await saveChecklistToCache(doc2Hash, doc2File.name, doc2File.size, rawData2.checklist_unifiee, metadata)
        } else if (rawData2 && rawData2.sections) {
          // Format 1: {"document": {...}, "sections": [...]}
          console.log("[v0] Doc2 document:", rawData2.document?.title)
          console.log("[v0] Doc2 sections:", rawData2.sections?.length)
          
          const checklist_unifiee: any[] = []
          
          rawData2.sections.forEach((section: any) => {
            if (section.items && section.items.length > 0) {
              section.items.forEach((item: any) => {
                checklist_unifiee.push({
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
          
          console.log("[v0] Parsed", checklist_unifiee.length, "items from doc2")
          
          const metadata = {
            filename: doc2File.name,
            source: rawData2.document?.title || "Document 2",
            document: rawData2.document
          }
          
          setDoc2Data({
            checklist_unifiee,
            metadata
          })
          
          // Save to cache
          console.log("[v0] Saving doc2 to cache...")
          await saveChecklistToCache(doc2Hash, doc2File.name, doc2File.size, checklist_unifiee, metadata)
        } else {
          console.error("[v0] Doc2 has unexpected structure")
        }
      }

      console.log("[v0] Documents analyzed successfully")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to analyze documents"
      setError(errorMsg)
      console.error("[v0] Analysis error:", err)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFuse = async () => {
    if (!doc1Selected.length || !doc2Selected.length) {
      setError("Please select items from both documents")
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log("[v0] Fusing selected items...")
      console.log("[v0] Doc1 selected items:", doc1Selected.length)
      console.log("[v0] Doc2 selected items:", doc2Selected.length)
      console.log("[v0] Doc1 items:", doc1Selected)
      console.log("[v0] Doc2 items:", doc2Selected)

      // Prepare the payload as JSON
      const payload = {
        doc1_items: doc1Selected,
        doc2_items: doc2Selected
      }

      const response = await fetch("https://karim.n8nkk.tech/webhook/8a1abe39-1ef4-4ec9-b9ab-8915c4b38dd6", {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload)
      })

      console.log("[v0] Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Error response:", errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const responseText = await response.text()
      console.log("[v0] Response body:", responseText)

      const rawData = responseText ? JSON.parse(responseText) : {}

      // Check if this is the new fusion_decision format
      if (rawData.fusion_decision) {
        // New format with fusion_decision
        console.log("[v0] New fusion format detected")
        setFusionResponse(rawData)
        setFusedData(null) // Clear old fusedData
      } else {
        // Old format - transform as before
        console.log("[v0] Old fusion format detected, transforming...")
        const transformedData = transformWebhookResponse(rawData)
        console.log("[v0] Transformed data:", transformedData)
        setFusedData(transformedData)
        setFusionResponse(null) // Clear fusionResponse
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fuse documents. Check webhook URL and CORS settings."
      setError(errorMsg)
      console.error("[v0] Fuse error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleManualFuse = () => {
    setShowManualEditor(true)
  }

  const handleSaveManualFusion = (mergedItem: any) => {
    console.log("[v0] Manual fusion saved:", mergedItem)
    
    // Add to fusion results array
    const newResult = {
      type: 'manual',
      timestamp: new Date().toISOString(),
      doc1_items: doc1Selected,
      doc2_items: doc2Selected,
      merged_item: mergedItem,
      decision: 'manually_fused'
    }
    
    setFusionResults(prev => [...prev, newResult])
    
    // Clear current fusion response and close editor
    setShowManualEditor(false)
    setFusionResponse(null)
    
    // Clear selections so user can select next items
    setDoc1Selected([])
    setDoc2Selected([])
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-full px-4 py-3">
          <h1 className="text-2xl font-bold text-slate-900">Certification Checklist Fuser</h1>
          <p className="text-slate-600 text-sm">Upload two certification checklists and merge them with AI intelligence</p>
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
                {fusionResponse ? "Review current fusion" : fusionResults.length > 0 ? `${fusionResults.length} fusion(s) saved` : "AI-merged results"}
              </p>
            </div>
            {fusionResponse ? (
              <FusionResultDisplay 
                fusionResponse={fusionResponse}
                doc1Selected={doc1Selected}
                doc2Selected={doc2Selected}
                onAcceptFusion={handleAcceptFusion}
                onManualFuse={handleManualFuse}
                onKeepSeparate={handleKeepSeparate}
              />
            ) : fusionResults.length > 0 ? (
              <FusionResultsList 
                results={fusionResults}
                onClear={handleClearResults}
              />
            ) : fusedData ? (
              <FusedChecklistDisplay data={fusedData} setFusedData={setFusedData} />
            ) : (
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
                    {!doc1Data || !doc2Data ? "Click 'Analyze Documents' button" : "to see merged results"}
                  </p>
                </div>
              </div>
            )}
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

        {/* Action Buttons */}
        <div className="mt-3 flex justify-center gap-3">
          {/* Analyze Documents Button */}
          <button
            onClick={handleAnalyzeDocuments}
            disabled={!doc1File || !doc2File || analyzing || (!!doc1Data && !!doc2Data)}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              !doc1File || !doc2File || analyzing || (!!doc1Data && !!doc2Data)
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl"
            }`}
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analyzing...
              </span>
            ) : doc1Data && doc2Data ? (
              "✓ Documents Analyzed"
            ) : (
              "Analyze Documents"
            )}
          </button>

          {/* Fuse Button */}
          <FuseButton 
            isDisabled={!doc1Data || !doc2Data || !doc1Selected.length || !doc2Selected.length || loading} 
            isLoading={loading} 
            onClick={handleFuse} 
          />
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
