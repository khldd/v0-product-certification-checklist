"use client"

import { useState } from "react"

interface ChecklistItemSelectorProps {
  itemId: string
  item: {
    doc1?: string
    doc2?: string
    fused?: string
  }
  selectedOption: string
  editingText: string
  onSelectOption: (option: string) => void
  onEditItem: (text: string) => void
}

export default function ChecklistItemSelector({
  itemId,
  item,
  selectedOption,
  editingText,
  onSelectOption,
  onEditItem,
}: ChecklistItemSelectorProps) {
  const [isEditing, setIsEditing] = useState(false)

  const options = [
    { key: "fused", label: "Use Fused", value: item.fused, color: "green" },
    { key: "both", label: "Keep Both", value: `${item.doc1} + ${item.doc2}`, color: "blue" },
    { key: "doc1", label: "Use Doc1", value: item.doc1, color: "blue" },
    { key: "doc2", label: "Use Doc2", value: item.doc2, color: "red" },
  ]

  const selectedText =
    selectedOption === "custom" ? editingText : options.find((o) => o.key === selectedOption)?.value || item.fused

  return (
    <div className="p-4 space-y-3">
      {/* Current Selection Display */}
      <div className="bg-slate-50 rounded p-3">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Selected:</p>
        {isEditing ? (
          <textarea
            value={editingText}
            onChange={(e) => onEditItem(e.target.value)}
            onBlur={() => setIsEditing(false)}
            className="w-full p-2 border border-slate-300 rounded text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={2}
            autoFocus
          />
        ) : (
          <div
            onClick={() => {
              onSelectOption("custom")
              setIsEditing(true)
            }}
            className="text-slate-900 font-medium text-sm cursor-pointer hover:text-slate-700 break-words"
          >
            {selectedText}
          </div>
        )}
      </div>

      {/* Option Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            onClick={() => onSelectOption(option.key)}
            className={`px-3 py-2 rounded text-sm font-medium transition ${
              selectedOption === option.key
                ? `bg-${option.color}-600 text-white`
                : `border border-${option.color}-200 text-${option.color}-700 hover:bg-${option.color}-50`
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Source Information */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {item.doc1 && (
          <div className="bg-blue-50 p-2 rounded border border-blue-200">
            <p className="font-semibold text-blue-900">Doc 1:</p>
            <p className="text-blue-700 truncate">{item.doc1}</p>
          </div>
        )}
        {item.doc2 && (
          <div className="bg-red-50 p-2 rounded border border-red-200">
            <p className="font-semibold text-red-900">Doc 2:</p>
            <p className="text-red-700 truncate">{item.doc2}</p>
          </div>
        )}
      </div>
    </div>
  )
}
