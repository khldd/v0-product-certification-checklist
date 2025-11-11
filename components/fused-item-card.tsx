"use client"

import { useState } from "react"
import { Check, Edit2, X, ChevronDown, ChevronUp } from "lucide-react"
import type { AutoFusionResult } from "@/hooks/useAutoFusion"

interface FusedItemCardProps {
  fusion: AutoFusionResult
  onAccept: (fusion: AutoFusionResult) => void
  onEdit: (fusion: AutoFusionResult) => void
  onReject: (fusion: AutoFusionResult) => void
  isAccepted?: boolean
}

export default function FusedItemCard({
  fusion,
  onAccept,
  onEdit,
  onReject,
  isAccepted = false
}: FusedItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const { fusion_decision, result } = fusion
  const mergedItem = result.merged_item
  const canFuse = fusion_decision.can_fuse

  return (
    <div className={`rounded-lg border-2 overflow-hidden transition-all ${
      isAccepted
        ? 'bg-green-50 border-green-300 dark:bg-green-900/10'
        : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          {/* AI Badge */}
          <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
            fusion_decision.can_fuse ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
          }`}>
            AI
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Merged Question or Comparison */}
        <div className="mb-3">
          {canFuse && mergedItem?.section && (
            <div className="text-xs font-semibold text-slate-600 mb-1">
              {mergedItem.section}
            </div>
          )}
          <div className="text-base font-medium text-slate-800">
            {canFuse && mergedItem
              ? mergedItem.question
              : `${fusion.doc1_items?.[0]?.question || 'Item 1'} vs ${fusion.doc2_items?.[0]?.question || 'Item 2'}`
            }
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            {canFuse ? 'Merges' : 'Compares'}: {fusion.doc1_items?.length || 0} + {fusion.doc2_items?.length || 0} items
          </span>
          {canFuse && mergedItem?.status && (
            <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-300">
              {mergedItem.status}
            </span>
          )}
          {!canFuse && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded border border-orange-300 font-semibold">
              Not Fusable
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
          {/* AI Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-800 mb-1">AI Analysis:</div>
            <div className="text-sm text-slate-700">{fusion_decision.explanation}</div>
          </div>

          {/* Source Items */}
          <div className="grid grid-cols-2 gap-3">
            {/* Doc 1 Items */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <div className="text-xs font-semibold text-blue-800 mb-2">
                From Document 1 ({fusion.doc1_items.length})
              </div>
              <div className="space-y-1">
                {fusion.doc1_items.map((item: any, idx: number) => (
                  <div key={idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-blue-100">
                    {item.question || item.label || '(No text)'}
                  </div>
                ))}
              </div>
            </div>

            {/* Doc 2 Items */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <div className="text-xs font-semibold text-red-800 mb-2">
                From Document 2 ({fusion.doc2_items.length})
              </div>
              <div className="space-y-1">
                {fusion.doc2_items.map((item: any, idx: number) => (
                  <div key={idx} className="text-xs text-slate-600 bg-white p-2 rounded border border-red-100">
                    {item.question || item.label || '(No text)'}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Options (only for fusable items) */}
          {canFuse && mergedItem?.options && mergedItem.options.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-2">Options:</div>
              <div className="space-y-1">
                {mergedItem.options.map((option: any, idx: number) => (
                  <div key={idx} className="text-sm bg-white p-2 rounded border border-slate-200">
                    <div className="font-medium">{option.label}</div>
                    {(option.original_doc1 || option.original_doc2) && (
                      <div className="text-xs text-slate-500 mt-1">
                        {option.original_doc1 && <div>• Doc1: {option.original_doc1}</div>}
                        {option.original_doc2 && <div>• Doc2: {option.original_doc2}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes (only for fusable items) */}
          {canFuse && mergedItem?.notes && (
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Notes:</div>
              <div className="text-sm bg-yellow-50 border border-yellow-200 rounded p-2">
                {mergedItem.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!isAccepted && (
        <div className="border-t border-slate-200 p-3 bg-slate-50 flex gap-2">
          <button
            onClick={() => onAccept(fusion)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={() => onEdit(fusion)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => onReject(fusion)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold text-sm flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}

      {/* Accepted Badge */}
      {isAccepted && (
        <div className="border-t border-green-300 p-3 bg-green-100 text-center">
          <span className="text-sm font-semibold text-green-800 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Accepted & Added to Checklist
          </span>
        </div>
      )}
    </div>
  )
}
