"use client"

import { useState } from "react"

interface ManualFusionEditorProps {
  doc1Items: any[]
  doc2Items: any[]
  suggestedMerge?: any | null
  onSave: (mergedItem: any) => void
  onCancel: () => void
}

export default function ManualFusionEditor({ 
  doc1Items, 
  doc2Items, 
  suggestedMerge,
  onSave, 
  onCancel 
}: ManualFusionEditorProps) {
  const [mergedItem, setMergedItem] = useState({
    section: suggestedMerge?.section || doc1Items[0]?.section || "",
    subsection: suggestedMerge?.subsection || doc1Items[0]?.subsection || "",
    question: suggestedMerge?.question || "",
    status: suggestedMerge?.status || "",
    options: suggestedMerge?.options || [],
    notes: suggestedMerge?.notes || "",
    page: ""
  })

  const [selectedOptions, setSelectedOptions] = useState<any[]>(
    suggestedMerge?.options || []
  )

  // Get all unique options from both documents
  const allOptions = [
    ...(doc1Items[0]?.options || []).map((opt: any) => ({ ...opt, source: 'doc1' })),
    ...(doc2Items[0]?.options || []).map((opt: any) => ({ ...opt, source: 'doc2' }))
  ]

  const toggleOption = (option: any) => {
    const exists = selectedOptions.find(
      opt => opt.label === option.label && opt.source === option.source
    )
    if (exists) {
      setSelectedOptions(selectedOptions.filter(
        opt => !(opt.label === option.label && opt.source === option.source)
      ))
    } else {
      setSelectedOptions([...selectedOptions, option])
    }
  }

  const handleSave = () => {
    const finalMergedItem = {
      ...mergedItem,
      options: selectedOptions,
      fusion_metadata: {
        manually_created: true,
        created_at: new Date().toISOString(),
        source_doc1_items: doc1Items.length,
        source_doc2_items: doc2Items.length
      }
    }
    onSave(finalMergedItem)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-2xl font-bold">Manual Fusion Editor</h2>
          <p className="text-sm text-blue-100 mt-1">
            Create a custom merged checklist item from both sources
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Source Document 1 */}
            <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">DOC 1</span>
                Source Items
              </h3>
              {doc1Items.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-blue-200 mb-2">
                  <div className="text-xs font-semibold text-blue-800">{item.section}</div>
                  <div className="text-sm text-slate-700 mt-1 font-medium">{item.question}</div>
                  {item.status && (
                    <div className="mt-2 text-xs">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                    </div>
                  )}
                  {item.options && item.options.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.options.map((opt: any, optIdx: number) => (
                        <div key={optIdx} className="text-xs text-slate-600 pl-2 border-l-2 border-blue-300">
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Source Document 2 */}
            <div className="border-2 border-red-300 rounded-lg p-4 bg-red-50">
              <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">DOC 2</span>
                Source Items
              </h3>
              {doc2Items.map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-red-200 mb-2">
                  <div className="text-xs font-semibold text-red-800">{item.section}</div>
                  <div className="text-sm text-slate-700 mt-1 font-medium">{item.question}</div>
                  {item.status && (
                    <div className="mt-2 text-xs">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                    </div>
                  )}
                  {item.options && item.options.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.options.map((opt: any, optIdx: number) => (
                        <div key={optIdx} className="text-xs text-slate-600 pl-2 border-l-2 border-red-300">
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Merged Item Editor */}
          <div className="border-2 border-green-400 rounded-lg p-4 bg-green-50">
            <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">MERGED</span>
              Create Your Fused Item
            </h3>

            <div className="space-y-4">
              {/* Section */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  value={mergedItem.section}
                  onChange={(e) => setMergedItem({ ...mergedItem, section: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., A.1.2"
                />
              </div>

              {/* Subsection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Subsection (optional)
                </label>
                <input
                  type="text"
                  value={mergedItem.subsection}
                  onChange={(e) => setMergedItem({ ...mergedItem, subsection: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Product Description"
                />
              </div>

              {/* Question */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Question / Item Text *
                </label>
                <textarea
                  value={mergedItem.question}
                  onChange={(e) => setMergedItem({ ...mergedItem, question: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 h-24"
                  placeholder="Write the merged question text..."
                  required
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <input
                  type="text"
                  value={mergedItem.status}
                  onChange={(e) => setMergedItem({ ...mergedItem, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Mandatory, Conditional"
                />
              </div>

              {/* Options Selection */}
              {allOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Select Options to Include
                  </label>
                  <div className="space-y-2 max-h-48 overflow-auto bg-white p-3 rounded-lg border border-slate-300">
                    {allOptions.map((option, idx) => {
                      const isSelected = selectedOptions.some(
                        opt => opt.label === option.label && opt.source === option.source
                      )
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 p-2 rounded cursor-pointer transition ${
                            isSelected 
                              ? 'bg-green-100 border border-green-300' 
                              : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOption(option)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">
                              {option.label}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              From: <span className={`font-semibold ${
                                option.source === 'doc1' ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {option.source === 'doc1' ? 'Document 1' : 'Document 2'}
                              </span>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={mergedItem.notes}
                  onChange={(e) => setMergedItem({ ...mergedItem, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 h-20"
                  placeholder="Add any additional notes or clarifications..."
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-300">
            <h4 className="font-semibold text-slate-700 mb-2">Preview:</h4>
            <div className="text-sm text-slate-600">
              <div><strong>Section:</strong> {mergedItem.section || '(not set)'}</div>
              {mergedItem.subsection && <div><strong>Subsection:</strong> {mergedItem.subsection}</div>}
              <div className="mt-2"><strong>Question:</strong> {mergedItem.question || '(not set)'}</div>
              {mergedItem.status && <div className="mt-1"><strong>Status:</strong> {mergedItem.status}</div>}
              {selectedOptions.length > 0 && (
                <div className="mt-2">
                  <strong>Options ({selectedOptions.length}):</strong>
                  <ul className="list-disc list-inside mt-1">
                    {selectedOptions.map((opt, idx) => (
                      <li key={idx}>{opt.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              {mergedItem.notes && <div className="mt-2"><strong>Notes:</strong> {mergedItem.notes}</div>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t bg-slate-50 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!mergedItem.question || !mergedItem.section}
            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            Save Merged Item
          </button>
        </div>
      </div>
    </div>
  )
}
