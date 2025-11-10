"use client"

import { useState } from "react"

interface ChecklistItem {
  id: string
  section?: string
  sous_section?: string
  question: string
  selected?: boolean
  status?: string
  options?: Array<{ label: string; checked: boolean | null }>
  notes?: string | null
  page?: number
}

interface ChecklistViewerProps {
  data: any
  onSelectionChange?: (selectedItems: ChecklistItem[]) => void
  title: string
}

export default function ChecklistViewer({ data, onSelectionChange, title }: ChecklistViewerProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Parse checklist data - handle different formats
  const parseChecklist = () => {
    if (!data) return { sections: {} }
    
    // If data has a checklist_unifiee array, use that
    if (data.checklist_unifiee && Array.isArray(data.checklist_unifiee)) {
      const sections: Record<string, { subsections: Record<string, ChecklistItem[]> }> = {}
      
      data.checklist_unifiee.forEach((item: any) => {
        const sectionKey = item.section || "Other"
        const subsectionKey = item.sous_section || "General"
        
        if (!sections[sectionKey]) {
          sections[sectionKey] = { subsections: {} }
        }
        if (!sections[sectionKey].subsections[subsectionKey]) {
          sections[sectionKey].subsections[subsectionKey] = []
        }
        
        sections[sectionKey].subsections[subsectionKey].push({
          id: item.id,
          section: item.section,
          sous_section: item.sous_section,
          question: item.question,
          status: item.status,
          options: item.options,
          notes: item.notes,
          page: item.page
        })
      })
      
      return { sections }
    }
    
    // Otherwise assume it's already in sections format
    return data
  }

  const { sections } = parseChecklist()

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)

    // Notify parent of selection change
    if (onSelectionChange) {
      const selected: ChecklistItem[] = []
      Object.values(sections).forEach((section: any) => {
        Object.values(section.subsections || {}).forEach((items: any) => {
          items.forEach((item: ChecklistItem) => {
            if (newSelected.has(item.id)) {
              selected.push(item)
            }
          })
        })
      })
      onSelectionChange(selected)
    }
  }

  const toggleSelectAll = () => {
    const allItemIds: string[] = []
    Object.values(sections).forEach((section: any) => {
      Object.values(section.subsections || {}).forEach((items: any) => {
        items.forEach((item: ChecklistItem) => {
          allItemIds.push(item.id)
        })
      })
    })

    if (selectedItems.size === allItemIds.length) {
      // Deselect all
      setSelectedItems(new Set())
      if (onSelectionChange) onSelectionChange([])
    } else {
      // Select all
      setSelectedItems(new Set(allItemIds))
      if (onSelectionChange) {
        const selected: ChecklistItem[] = []
        Object.values(sections).forEach((section: any) => {
          Object.values(section.subsections || {}).forEach((items: any) => {
            items.forEach((item: ChecklistItem) => {
              selected.push(item)
            })
          })
        })
        onSelectionChange(selected)
      }
    }
  }

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
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b border-slate-300 bg-slate-50 px-3 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-600">
              {selectedItems.size} / {totalItems} selected
            </p>
          </div>
          <button
            onClick={toggleSelectAll}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-100 transition"
          >
            {selectedItems.size === totalItems ? "Deselect All" : "Select All"}
          </button>
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
                  className="w-full bg-slate-100 hover:bg-slate-200 px-3 py-2 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{sectionId}</span>
                    <span className="text-xs text-slate-500">({sectionItemCount} items)</span>
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
                            {items.map((item: ChecklistItem) => (
                              <div
                                key={item.id}
                                className="border-b border-slate-100 hover:bg-slate-50 transition"
                              >
                                <label className="flex items-start gap-3 p-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.has(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                    className="mt-1 w-4 h-4 shrink-0"
                                  />
                                  <div className="flex-1 text-sm">
                                    {/* Question */}
                                    <div className="text-slate-800 font-medium mb-1">{item.question}</div>
                                    
                                    {/* Status Badge */}
                                    {item.status && (
                                      <div className="mb-2">
                                        <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                                          {item.status}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Options */}
                                    {item.options && item.options.length > 0 && (
                                      <div className="mb-2 space-y-1">
                                        {item.options.map((option, idx) => (
                                          <div key={idx} className="flex items-start gap-2 text-xs">
                                            <span className="text-slate-400 shrink-0">
                                              {option.checked === true ? "☑" : option.checked === false ? "☐" : "○"}
                                            </span>
                                            <span className={option.checked === true ? "text-green-700" : "text-slate-600"}>
                                              {option.label}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* Notes */}
                                    {item.notes && (
                                      <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 rounded text-xs text-slate-700">
                                        <span className="font-semibold text-yellow-800">Note: </span>
                                        {item.notes}
                                      </div>
                                    )}
                                    
                                    {/* Page number */}
                                    {item.page && (
                                      <div className="mt-1 text-xs text-slate-400">
                                        Page {item.page}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              </div>
                            ))}
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
