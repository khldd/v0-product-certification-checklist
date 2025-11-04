"use client"

import { useState } from "react"
import DocumentUploader from "@/components/document-uploader"
import PDFViewer from "@/components/pdf-viewer"
import FuseButton from "@/components/fuse-button"
import FusedChecklistDisplay from "@/components/fused-checklist-display"

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
  const [fusedData, setFusedData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDoc1Upload = (file: File) => {
    if (file.type === "application/pdf") {
      setDoc1File(file)
      setError(null)
    } else {
      setError("Please upload a PDF file")
    }
  }

  const handleDoc2Upload = (file: File) => {
    if (file.type === "application/pdf") {
      setDoc2File(file)
      setError(null)
    } else {
      setError("Please upload a PDF file")
    }
  }

  const handleFuse = async () => {
    if (!doc1File || !doc2File) {
      setError("Both documents are required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("doc1", doc1File)
      formData.append("doc2", doc2File)

      console.log("[v0] Sending request to webhook...")
      console.log("[v0] File 1:", doc1File.name, doc1File.size, "bytes")
      console.log("[v0] File 2:", doc2File.name, doc2File.size, "bytes")

      const response = await fetch("https://karim.n8nkk.tech/webhook/8a1abe39-1ef4-4ec9-b9ab-8915c4b38dd6", {
        method: "POST",
        body: formData,
        mode: "cors",
        headers: {
          Accept: "application/json",
        },
      })

      console.log("[v0] Response status:", response.status)
      console.log("[v0] Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Error response:", errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const responseText = await response.text()
      console.log("[v0] Response body:", responseText)

      const rawData = responseText ? JSON.parse(responseText) : {}

      // Transform the data to match the expected format
      const transformedData = transformWebhookResponse(rawData)
      console.log("[v0] Transformed data:", transformedData)

      setFusedData(transformedData)
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fuse documents. Check webhook URL and CORS settings."
      setError(errorMsg)
      console.error("[v0] Fuse error:", err)
    } finally {
      setLoading(false)
    }
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
        <div className="grid grid-cols-3 gap-4 h-[calc(100vh-140px)]">
          {/* Left Panel - Document 1 */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
              <h2 className="text-base font-semibold text-blue-900">Document 1</h2>
              <p className="text-xs text-blue-700">Upload first checklist</p>
            </div>
            {!doc1File ? (
              <DocumentUploader onUpload={handleDoc1Upload} label="Drop PDF here" />
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
              <p className="text-xs text-green-700">AI-merged result</p>
            </div>
            {fusedData ? (
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
                  <p className="text-slate-500 font-medium">Upload both documents</p>
                  <p className="text-slate-400 text-sm mt-1">then click Fuse to see results</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Document 2 */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-red-50 border-b border-red-200 px-4 py-2">
              <h2 className="text-base font-semibold text-red-900">Document 2</h2>
              <p className="text-xs text-red-700">Upload second checklist</p>
            </div>
            {!doc2File ? (
              <DocumentUploader onUpload={handleDoc2Upload} label="Drop PDF here" />
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                <PDFViewer file={doc2File} />
              </div>
            )}
          </div>
        </div>

        {/* Fuse Button */}
        <div className="mt-3 flex justify-center">
          <FuseButton isDisabled={!doc1File || !doc2File || loading} isLoading={loading} onClick={handleFuse} />
        </div>
      </div>
    </main>
  )
}
