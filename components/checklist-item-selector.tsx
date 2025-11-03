"use client"

import { useState } from "react"

interface ChecklistItemSelectorProps {
  itemId: string
  item: {
    id: string
    question: string
    fused_text: string
    original_texts?: Record<string, string>
    origine: string[]
    sous_section: string
  }
  selectedOption: string
  editedText: string
  onSelectOption: (option: string) => void
  onEditItem: (text: string) => void
}

export default function ChecklistItemSelector({
  itemId,
  item,
  selectedOption,
  editedText,
  onSelectOption,
  onEditItem,
}: ChecklistItemSelectorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showOriginals, setShowOriginals] = useState(false)

  // Get all unique source names
  const sources = item.origine || []
  const originalTexts = item.original_texts || {}

  // Determine what text to show based on selection
  const getDisplayText = () => {
    if (editedText) return editedText

    if (selectedOption === "fusion") {
      return item.fused_text || item.question
    }

    // Check if selection matches a specific source
    const matchedSource = sources.find((src) => selectedOption === `keep_source_${src}`)
    if (matchedSource && originalTexts[matchedSource]) {
      return originalTexts[matchedSource]
    }

    // Handle "keep_both" or "keep_all" - show all sources
    if (selectedOption === "keep_both" || selectedOption === "keep_all") {
      const allTexts = sources
        .filter((src) => originalTexts[src])
        .map((src) => `${src}: ${originalTexts[src]}`)
        .join("\n\n")
      return allTexts || item.fused_text || item.question
    }

    return item.fused_text || item.question
  }

  const displayText = getDisplayText()

  // Helper to get badge color for source
  const getSourceBadgeColor = (source: string) => {
    // Hash the source name to get a consistent color
    let hash = 0
    for (let i = 0; i < source.length; i++) {
      hash = source.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colors = [
      { bg: "bg-blue-100", text: "text-blue-700" },
      { bg: "bg-green-100", text: "text-green-700" },
      { bg: "bg-purple-100", text: "text-purple-700" },
      { bg: "bg-orange-100", text: "text-orange-700" },
      { bg: "bg-pink-100", text: "text-pink-700" },
      { bg: "bg-indigo-100", text: "text-indigo-700" },
    ]
    return colors[Math.abs(hash) % colors.length]
  }

  // Helper to get short name for source
  const getShortName = (source: string) => {
    // Try to extract acronym or shorten long names
    if (source.length <= 10) return source
    
    // Extract uppercase letters as acronym
    const acronym = source.match(/[A-Z]/g)?.join("") || source.substring(0, 8)
    return acronym.length > 2 ? acronym : source.substring(0, 10)
  }

  return (
    <div className="border-b border-slate-200 hover:bg-slate-50 transition">
      <div className="p-2 flex items-start gap-3">
        {/* Text Display/Edit Area */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              value={editedText || displayText}
              onChange={(e) => onEditItem(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setIsEditing(false)
              }}
              className="w-full p-2 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-sm text-slate-800 cursor-text hover:bg-slate-100 p-1 rounded min-h-[2.5rem] whitespace-pre-wrap"
              title="Click to edit"
            >
              {displayText}
            </div>
          )}

          {/* Source Badges */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {sources.map((source) => {
              const colors = getSourceBadgeColor(source)
              const shortName = getShortName(source)
              return (
                <span
                  key={source}
                  className={`text-xs px-1.5 py-0.5 ${colors.bg} ${colors.text} rounded`}
                  title={source}
                >
                  {shortName}
                </span>
              )
            })}
            {Object.keys(originalTexts).length > 0 && (
              <button
                onClick={() => setShowOriginals(!showOriginals)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showOriginals ? "Hide" : "Show"} originals
              </button>
            )}
          </div>

          {/* Original Sources (Expandable) */}
          {showOriginals && Object.keys(originalTexts).length > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              {Object.entries(originalTexts).map(([source, text]) => {
                const colors = getSourceBadgeColor(source)
                return (
                  <div key={source} className={`p-2 ${colors.bg} border border-slate-300 rounded`}>
                    <span className={`font-semibold ${colors.text}`}>{source}: </span>
                    <span className={colors.text}>{text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selection Controls */}
        <div className="flex flex-col gap-1 text-xs shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
            <input
              type="radio"
              name={`select-${itemId}`}
              checked={selectedOption === "fusion"}
              onChange={() => onSelectOption("fusion")}
              className="w-3 h-3"
            />
            <span className="text-slate-700">Fused</span>
          </label>

          {sources.map((source) => {
            const optionValue = `keep_source_${source}`
            const shortName = getShortName(source)
            if (!originalTexts[source]) return null
            
            return (
              <label
                key={source}
                className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded"
                title={source}
              >
                <input
                  type="radio"
                  name={`select-${itemId}`}
                  checked={selectedOption === optionValue}
                  onChange={() => onSelectOption(optionValue)}
                  className="w-3 h-3"
                />
                <span className="text-slate-700">{shortName}</span>
              </label>
            )
          })}

          {sources.length > 1 && Object.keys(originalTexts).length > 1 && (
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
              <input
                type="radio"
                name={`select-${itemId}`}
                checked={selectedOption === "keep_both" || selectedOption === "keep_all"}
                onChange={() => onSelectOption("keep_both")}
                className="w-3 h-3"
              />
              <span className="text-slate-700">All</span>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}