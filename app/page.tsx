"use client"

import { useState } from "react"
import DocumentUploader from "@/components/document-uploader"
import PDFViewer from "@/components/pdf-viewer"
import FuseButton from "@/components/fuse-button"
import FusedChecklistDisplay from "@/components/fused-checklist-display"

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

      const response = await fetch("https://karim.n8nkk.tech/webhook-test/8a1abe39-1ef4-4ec9-b9ab-8915c4b38dd6", {
        method: "POST",
        body: formData,
        mode: "cors",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setFusedData(data)
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
        <div className="max-w-full px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900">Certification Checklist Fuser</h1>
          <p className="text-slate-600 mt-1">Upload two certification checklists and merge them with AI intelligence</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-8 mt-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-220px)]">
          {/* Left Panel - Document 1 */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-blue-900">Document 1</h2>
              <p className="text-sm text-blue-700 mt-1">Upload first checklist</p>
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
            <div className="bg-green-50 border-b border-green-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-green-900">Fused Checklist</h2>
              <p className="text-sm text-green-700 mt-1">AI-merged result</p>
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
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-red-900">Document 2</h2>
              <p className="text-sm text-red-700 mt-1">Upload second checklist</p>
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
        <div className="mt-6 flex justify-center">
          <FuseButton isDisabled={!doc1File || !doc2File || loading} isLoading={loading} onClick={handleFuse} />
        </div>
      </div>
    </main>
  )
}
