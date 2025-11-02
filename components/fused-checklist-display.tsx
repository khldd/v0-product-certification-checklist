"use client"

import { useState } from "react"
import ChecklistItemSelector from "./checklist-item-selector"
import { ExportHandler } from "./export-handler"

interface FusedChecklistDisplayProps {
  data: any
  setFusedData: (data: any) => void
}

export default function FusedChecklistDisplay({ data, setFusedData }: FusedChecklistDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(Object.keys(data.sections || {}))
  )
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

  // Count total items
  const totalItems = Object.values(sections).reduce((total: number, section: any) => {
    return (
      total +
      Object.values(section.subsections || {}).reduce(
        (subTotal: number, items: any) => subTotal + (items?.length || 0),
        0
      )
    )
  }, 0)

  return (
    <div className="flex-1 overflow-auto flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-slate-300 bg-slate-50 px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Fused Checklist</h3>
            <p className="text-xs text-slate-600">{totalItems} items</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFusedData(null)
                setSelections({})
                setEditingItems({})
              }}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
            >
              Clear
            </button>
            <button
              onClick={exportJSON}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
            >
              JSON
            </button>
            <button
              onClick={exportPDF}
              className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition font-medium"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Items Container */}
      <div className="flex-1 overflow-auto">
        {Object.entries(sections)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([sectionId, section]: [string, any]) => {
            const subsections = section.subsections || {}
            const sectionItemCount = Object.values(subsections).reduce(
              (total: number, items: any) => total + (items?.length || 0),
              0
            )

            return (
              <div key={sectionId} className="border-b border-slate-300">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(sectionId)}
                  className="w-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{sectionId}.</span>
                    <span className="text-xs text-slate-600">({sectionItemCount} items)</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      expandedSections.has(sectionId) ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Subsections */}
                {expandedSections.has(sectionId) && (
                  <div>
                    {Object.entries(subsections)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([subsectionName, items]: [string, any]) => (
                        <div key={`${sectionId}-${subsectionName}`} className="border-b border-slate-200">
                          {/* Subsection Header */}
                          <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
                            <h4 className="text-xs font-semibold text-slate-700">{subsectionName}</h4>
                          </div>

                          {/* Items */}
                          <div>
                            {items.map((item: any, idx: number) => {
                              const itemKey = `${sectionId}-${subsectionName}-${idx}`
                              return (
                                <ChecklistItemSelector
                                  key={itemKey}
                                  itemId={itemKey}
                                  item={item}
                                  selectedOption={selections[itemKey] || "fusion"}
                                  editedText={editingItems[itemKey] || ""}
                                  onSelectOption={(option) => handleSelectOption(itemKey, option)}
                                  onEditItem={(text) => handleEditItem(itemKey, text)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
