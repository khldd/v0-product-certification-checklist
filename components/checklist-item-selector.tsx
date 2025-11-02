"use client"

import { useState } from "react"

interface ChecklistItemSelectorProps {
  itemId: string
  item: {
    id: string
    question: string
    fused_text: string
    original_ch: string
    original_bs: string
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

  // Determine what text to show based on selection
  const getDisplayText = () => {
    if (editedText) return editedText

    switch (selectedOption) {
      case "fusion":
        return item.fused_text || item.question
      case "keep_source_CH":
        return item.original_ch || item.fused_text || item.question
      case "keep_source_BS":
        return item.original_bs || item.fused_text || item.question
      case "keep_both":
        const bsText = item.original_bs || ""
        const chText = item.original_ch || ""
        if (bsText && chText) {
          return `BS: ${bsText}\n\nCH: ${chText}`
        } else if (bsText) {
          return `BS: ${bsText}`
        } else if (chText) {
          return `CH: ${chText}`
        }
        return item.fused_text || item.question
      default:
        return item.fused_text || item.question
    }
  }

  const displayText = getDisplayText()

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
          <div className="flex items-center gap-2 mt-1">
            {item.origine.includes("CH") && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">CH</span>
            )}
            {item.origine.includes("BS") && (
              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">BS</span>
            )}
            {(item.original_ch || item.original_bs) && (
              <button
                onClick={() => setShowOriginals(!showOriginals)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showOriginals ? "Hide" : "Show"} originals
              </button>
            )}
          </div>

          {/* Original Sources (Expandable) */}
          {showOriginals && (item.original_ch || item.original_bs) && (
            <div className="mt-2 space-y-1 text-xs">
              {item.original_ch && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                  <span className="font-semibold text-blue-900">CH: </span>
                  <span className="text-blue-700">{item.original_ch}</span>
                </div>
              )}
              {item.original_bs && (
                <div className="p-2 bg-green-50 border border-green-200 rounded">
                  <span className="font-semibold text-green-900">BS: </span>
                  <span className="text-green-700">{item.original_bs}</span>
                </div>
              )}
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

          {item.original_ch && (
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
              <input
                type="radio"
                name={`select-${itemId}`}
                checked={selectedOption === "keep_source_CH"}
                onChange={() => onSelectOption("keep_source_CH")}
                className="w-3 h-3"
              />
              <span className="text-slate-700">CH</span>
            </label>
          )}

          {item.original_bs && (
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
              <input
                type="radio"
                name={`select-${itemId}`}
                checked={selectedOption === "keep_source_BS"}
                onChange={() => onSelectOption("keep_source_BS")}
                className="w-3 h-3"
              />
              <span className="text-slate-700">BS</span>
            </label>
          )}

          {item.original_ch && item.original_bs && (
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded">
              <input
                type="radio"
                name={`select-${itemId}`}
                checked={selectedOption === "keep_both"}
                onChange={() => onSelectOption("keep_both")}
                className="w-3 h-3"
              />
              <span className="text-slate-700">Both</span>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
