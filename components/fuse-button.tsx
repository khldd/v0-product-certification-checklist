"use client"

import { Zap } from "lucide-react"

interface FuseButtonProps {
  isDisabled: boolean
  isLoading: boolean
  onClick: () => void
  doc1SelectedCount?: number
  doc2SelectedCount?: number
}

export default function FuseButton({
  isDisabled,
  isLoading,
  onClick,
  doc1SelectedCount = 0,
  doc2SelectedCount = 0
}: FuseButtonProps) {
  const totalSelected = doc1SelectedCount + doc2SelectedCount
  const hasSelection = totalSelected > 0

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`px-8 py-3 rounded-lg font-semibold text-white transition-all flex items-center gap-2 shadow-lg ${
          isDisabled
            ? "bg-slate-400 cursor-not-allowed"
            : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 shadow-emerald-500/50"
        }`}
      >
        {isLoading ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Analyzing with AI...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            {hasSelection ? `Process ${totalSelected} Item${totalSelected > 1 ? 's' : ''}` : 'Fuse Selected Items'}
          </>
        )}
      </button>

      {/* Selection Counter */}
      {hasSelection && !isLoading && (
        <div className="text-xs text-slate-600 flex items-center gap-3">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-300 font-semibold">
            Doc 1: {doc1SelectedCount}
          </span>
          <span className="text-slate-400">+</span>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded border border-red-300 font-semibold">
            Doc 2: {doc2SelectedCount}
          </span>
        </div>
      )}
    </div>
  )
}
