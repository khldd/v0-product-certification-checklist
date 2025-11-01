"use client"

import type React from "react"

import { useCallback } from "react"

interface DocumentUploaderProps {
  onUpload: (file: File) => void
  label?: string
}

export default function DocumentUploader({ onUpload, label = "Drop PDF here" }: DocumentUploaderProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      const files = e.dataTransfer.files
      if (files.length > 0) {
        onUpload(files[0])
      }
    },
    [onUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files
      if (files && files.length > 0) {
        onUpload(files[0])
      }
    },
    [onUpload],
  )

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex-1 flex items-center justify-center p-6 border-2 border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 transition"
    >
      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-slate-600 font-medium">{label}</p>
          <p className="text-slate-500 text-sm mt-1">or click to select</p>
        </div>
        <input type="file" accept=".pdf" onChange={handleFileInput} className="hidden" />
      </label>
    </div>
  )
}
