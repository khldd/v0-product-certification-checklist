"use client"

import { useState, useEffect, useRef } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"

interface PDFViewerProps {
  file: File
}

export default function PDFViewer({ file }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPDF = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist")

        // Use unpkg CDN as a reliable source
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const reader = new FileReader()

        reader.onload = async (e) => {
          if (cancelled) return

          if (e.target?.result) {
            try {
              const arrayBuffer = e.target.result as ArrayBuffer
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

              if (cancelled) {
                pdf.destroy()
                return
              }

              setPdfDoc(pdf)
              setNumPages(pdf.numPages)
              setCurrentPage(1)
              setLoading(false)
            } catch (err) {
              if (cancelled) return
              console.error("[v0] Error loading PDF:", err)
              setError("Failed to load PDF")
              setLoading(false)
            }
          }
        }

        reader.onerror = () => {
          if (cancelled) return
          setError("Failed to read file")
          setLoading(false)
        }

        reader.readAsArrayBuffer(file)
      } catch (err) {
        if (cancelled) return
        console.error("[v0] Error importing PDF.js:", err)
        setError("Failed to initialize PDF viewer")
        setLoading(false)
      }
    }

    loadPDF()

    // Cleanup function to destroy PDF document and cancel operations
    return () => {
      cancelled = true
      setPdfDoc((prevDoc) => {
        if (prevDoc) {
          prevDoc.destroy()
        }
        return null
      })
    }
  }, [file])

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1))
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error: {error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin inline-block">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                className="opacity-75"
              />
            </svg>
          </div>
          <p className="text-slate-500 mt-2 text-sm">Loading PDF...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* PDF Canvas Container */}
      <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4">
        <PDFPage pdfDoc={pdfDoc} pageNumber={currentPage} />
      </div>

      {/* Navigation Controls */}
      <div className="bg-slate-100 border-t border-slate-300 px-4 py-3 flex items-center justify-between">
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          className={`p-2 rounded transition ${
            currentPage === 1 ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-sm text-slate-600 font-medium">
          {currentPage} / {numPages}
        </div>

        <button
          onClick={handleNextPage}
          disabled={currentPage === numPages}
          className={`p-2 rounded transition ${
            currentPage === numPages ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function PDFPage({ pdfDoc, pageNumber }: { pdfDoc: PDFDocumentProxy | null; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<any>(null)

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    const canvas = canvasRef.current
    let cancelled = false

    const renderPage = async () => {
      try {
        // Cancel any ongoing render task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel()
          renderTaskRef.current = null
        }

        // Wait a tick to ensure previous render is fully cancelled
        await new Promise((resolve) => setTimeout(resolve, 0))

        if (cancelled || !canvas) return

        const page = await pdfDoc.getPage(pageNumber)

        if (cancelled) return

        const viewport = page.getViewport({ scale: 1.5 })

        // Clear the canvas before rendering
        const context = canvas.getContext("2d")
        if (!context) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        context.clearRect(0, 0, canvas.width, canvas.height)

        if (cancelled) return

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        renderTaskRef.current = page.render(renderContext as any)
        await renderTaskRef.current.promise

        if (!cancelled) {
          renderTaskRef.current = null
        }
      } catch (err: any) {
        // Ignore cancelled render errors
        if (err?.name === "RenderingCancelledException") {
          return
        }
        if (!cancelled) {
          console.error("[v0] Error rendering page:", err)
        }
      }
    }

    renderPage()

    // Cleanup function to cancel render on unmount or when dependencies change
    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNumber])

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-full shadow-lg bg-white"
      style={{ maxWidth: "100%", maxHeight: "calc(100vh - 200px)" }}
    />
  )
}
