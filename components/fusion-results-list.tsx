"use client"

import { useState } from "react"
import { exportFusionResultsAsPDF, exportFusionResultsAsTable, exportAsJSON, copyToClipboard } from "@/lib/export-utils"

interface FusionResultsListProps {
  results: any[]
  onClear: () => void
}

export default function FusionResultsList({ results, onClear }: FusionResultsListProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'ai_fused': return '🤖'
      case 'manual': return '✍️'
      case 'kept_separate': return '📋'
      default: return '•'
    }
  }

  const getResultBadge = (type: string) => {
    switch (type) {
      case 'ai_fused': return { text: 'AI Fused', color: 'bg-green-100 text-green-800 border-green-300' }
      case 'manual': return { text: 'Manual', color: 'bg-blue-100 text-blue-800 border-blue-300' }
      case 'kept_separate': return { text: 'Separate', color: 'bg-orange-100 text-orange-800 border-orange-300' }
      default: return { text: 'Unknown', color: 'bg-gray-100 text-gray-800 border-gray-300' }
    }
  }

  const getConfidenceBadge = (level?: string) => {
    if (!level) return null
    const colors = {
      'very_high': 'bg-green-100 text-green-700 border-green-300',
      'high': 'bg-blue-100 text-blue-700 border-blue-300',
      'medium': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'low': 'bg-orange-100 text-orange-700 border-orange-300',
      'very_low': 'bg-red-100 text-red-700 border-red-300',
    }
    return colors[level as keyof typeof colors] || colors.medium
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-slate-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">No fusion results yet</p>
          <p className="text-slate-400 text-sm mt-1">Start by selecting items and clicking Fuse</p>
        </div>
      </div>
    )
  }

  const fusedCount = results.filter(r => r.type === 'ai_fused' || r.type === 'manual').length
  const separateCount = results.filter(r => r.type === 'kept_separate').length

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Header with Stats */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Fusion Results</h3>
          <p className="text-xs text-slate-600">
            {fusedCount} fused • {separateCount} separate • {results.length} total
          </p>
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition border border-red-300"
        >
          Clear All
        </button>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((result, index) => {
          const badge = getResultBadge(result.type)
          const isExpanded = expandedItems.has(index)

          return (
            <div
              key={index}
              className="bg-white rounded-lg border-2 border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition"
            >
              {/* Header */}
              <div
                className="p-3 cursor-pointer hover:bg-slate-50 transition"
                onClick={() => toggleExpand(index)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-2xl">{getResultIcon(result.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${badge.color}`}>
                          {badge.text}
                        </span>
                        {result.confidence_level && (
                          <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${getConfidenceBadge(result.confidence_level)}`}>
                            {result.confidence}% {result.confidence_level}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      {/* Preview */}
                      {result.type !== 'kept_separate' && result.merged_item && (
                        <div className="text-sm text-slate-700 font-medium mt-1">
                          {result.merged_item.question || result.merged_item.label || '(No question)'}
                        </div>
                      )}
                      {result.type === 'kept_separate' && (
                        <div className="text-sm text-slate-600 mt-1">
                          Kept {result.doc1_items.length + result.doc2_items.length} items separate
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button className="text-slate-400 hover:text-slate-600">
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-200 p-3 bg-slate-50">
                  {/* Source Items */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                      <div className="text-xs font-semibold text-blue-800 mb-1">Doc 1 Items ({result.doc1_items.length})</div>
                      {result.doc1_items.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-slate-600 mb-1">
                          • {item.question || item.label || '(No question)'}
                        </div>
                      ))}
                    </div>
                    <div className="bg-red-50 p-2 rounded border border-red-200">
                      <div className="text-xs font-semibold text-red-800 mb-1">Doc 2 Items ({result.doc2_items.length})</div>
                      {result.doc2_items.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-slate-600 mb-1">
                          • {item.question || item.label || '(No question)'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Merged Item Details */}
                  {result.type !== 'kept_separate' && result.merged_item && (
                    <div className="bg-green-50 p-3 rounded border border-green-300">
                      <div className="text-xs font-semibold text-green-800 mb-2">Merged Item</div>
                      
                      {result.merged_item.section && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-600">Section:</span>
                          <span className="text-xs text-slate-700 ml-2">{result.merged_item.section}</span>
                        </div>
                      )}
                      
                      {result.merged_item.question && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-600">Question:</span>
                          <div className="text-xs text-slate-700 mt-1">{result.merged_item.question}</div>
                        </div>
                      )}

                      {result.merged_item.status && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-600">Status:</span>
                          <span className="text-xs text-slate-700 ml-2 px-2 py-0.5 bg-white rounded border">
                            {result.merged_item.status}
                          </span>
                        </div>
                      )}

                      {result.merged_item.options && result.merged_item.options.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-600">Options ({result.merged_item.options.length}):</span>
                          <div className="mt-1 space-y-1">
                            {result.merged_item.options.map((opt: any, idx: number) => (
                              <div key={idx} className="text-xs text-slate-600 pl-2 border-l-2 border-green-400">
                                {opt.label || opt.text || opt}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.merged_item.notes && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-600">Notes:</span>
                          <div className="text-xs text-slate-700 mt-1 bg-yellow-50 p-2 rounded border border-yellow-200">
                            {result.merged_item.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kept Separate Reason */}
                  {result.type === 'kept_separate' && result.reason && (
                    <div className="bg-orange-50 p-2 rounded border border-orange-200">
                      <div className="text-xs font-semibold text-orange-800 mb-1">Reason:</div>
                      <div className="text-xs text-slate-600">{result.reason}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Export/Download Section */}
      <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-300">
        <div className="text-xs font-semibold text-slate-700 mb-2">Export Options</div>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => exportFusionResultsAsPDF(results)}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition border border-red-700 font-semibold"
          >
            📄 Export as PDF (Detailed)
          </button>
          <button 
            onClick={() => exportFusionResultsAsTable(results)}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition border border-blue-700 font-semibold"
          >
            📊 Export as PDF (Table)
          </button>
          <button 
            onClick={() => exportAsJSON(results)}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition border border-green-700 font-semibold"
          >
            💾 Export as JSON
          </button>
          <button 
            onClick={() => copyToClipboard(results)}
            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition border border-purple-700 font-semibold"
          >
            📋 Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  )
}
