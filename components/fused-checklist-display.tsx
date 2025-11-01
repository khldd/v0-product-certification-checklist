"use client"

import { useState } from "react"
import ChecklistItemSelector from "./checklist-item-selector"
import { ExportHandler } from "./export-handler"

interface FusedChecklistDisplayProps {
  data: any
  setFusedData: (data: any) => void
}

export default function FusedChecklistDisplay({ data, setFusedData }: FusedChecklistDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(Object.keys(data.sections || {})))
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [editingItems, setEditingItems] = useState<Record<string, string>>({})

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const handleSelectOption = (itemId: string, option: string) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: option,
    }))
  }

  const handleEditItem = (itemId: string, value: string) => {
    setEditingItems((prev) => ({
      ...prev,
      [itemId]: value,
    }))
  }

  const { exportJSON, exportPDF } = ExportHandler({ data, selections, editingItems })

  const sections = data.sections || {}

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Items Container */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {Object.entries(sections).map(([sectionId, section]: [string, any]) => (
          <div key={sectionId} className="border border-slate-200 rounded-lg overflow-hidden">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sectionId)}
              className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-3 flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{sectionId}</span>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                  {section.items?.length || 0} items
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-slate-500 transition-transform ${
                  expandedSections.has(sectionId) ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {/* Section Items */}
            {expandedSections.has(sectionId) && (
              <div className="divide-y divide-slate-200 bg-white">
                {section.items?.map((item: any, idx: number) => (
                  <ChecklistItemSelector
                    key={`${sectionId}-${idx}`}
                    itemId={`${sectionId}-${idx}`}
                    item={item}
                    selectedOption={selections[`${sectionId}-${idx}`] || "fused"}
                    editingText={editingItems[`${sectionId}-${idx}`] || ""}
                    onSelectOption={(option) => handleSelectOption(`${sectionId}-${idx}`, option)}
                    onEditItem={(text) => handleEditItem(`${sectionId}-${idx}`, text)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-slate-200 bg-slate-50 p-4 flex gap-3">
        <button
          onClick={() => {
            setFusedData(null)
            setSelections({})
            setEditingItems({})
          }}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition font-medium"
        >
          Clear
        </button>
        <button
          onClick={exportJSON}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition font-medium"
        >
          Export JSON
        </button>
        <button
          onClick={exportPDF}
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
        >
          Export PDF
        </button>
      </div>
    </div>
  )
}
