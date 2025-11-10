"use client"

import { useState } from "react"

interface FusionResultDisplayProps {
  fusionResponse: {
    success: boolean
    fusion_decision: {
      can_fuse: boolean
      confidence_score: number
      confidence_level: string
      should_auto_apply: boolean
      explanation: string
    }
    result: {
      status: string
      merged_item: any | null
      action: string
    }
    metadata?: {
      processed_at?: string
      [key: string]: any
    }
  }
  doc1Selected: any[]
  doc2Selected: any[]
  onAcceptFusion: () => void
  onManualFuse: () => void
  onKeepSeparate: () => void
}

export default function FusionResultDisplay({ 
  fusionResponse, 
  doc1Selected, 
  doc2Selected,
  onAcceptFusion,
  onManualFuse,
  onKeepSeparate 
}: FusionResultDisplayProps) {
  const [showDetails, setShowDetails] = useState(true)

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'very_high': return 'text-green-700 bg-green-100 border-green-300'
      case 'high': return 'text-blue-700 bg-blue-100 border-blue-300'
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-300'
      case 'low': return 'text-orange-700 bg-orange-100 border-orange-300'
      default: return 'text-red-700 bg-red-100 border-red-300'
    }
  }

  const getConfidenceIcon = (level: string) => {
    switch (level) {
      case 'very_high': return '✓✓'
      case 'high': return '✓'
      case 'medium': return '◐'
      case 'low': return '⚠'
      default: return '✗'
    }
  }

  if (!fusionResponse.success) {
    return (
      <div className="p-6 bg-red-50 border-2 border-red-300 rounded-lg">
        <h3 className="text-lg font-bold text-red-800 mb-2">Fusion Error</h3>
        <p className="text-red-700">Failed to process fusion request. Please try again.</p>
      </div>
    )
  }

  const { fusion_decision, result } = fusionResponse

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">Fusion Analysis Result</h2>
        <p className="text-sm text-slate-600">AI-powered checklist item comparison</p>
      </div>

      {/* Decision Card */}
      <div className={`p-4 rounded-lg border-2 mb-4 ${
        fusion_decision.can_fuse 
          ? 'bg-green-50 border-green-300' 
          : 'bg-orange-50 border-orange-300'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`text-3xl ${fusion_decision.can_fuse ? 'text-green-600' : 'text-orange-600'}`}>
              {fusion_decision.can_fuse ? '✓' : '✗'}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${
                fusion_decision.can_fuse ? 'text-green-800' : 'text-orange-800'
              }`}>
                {fusion_decision.can_fuse ? 'Items Can Be Fused' : 'Items Cannot Be Fused'}
              </h3>
              <p className={`text-sm ${
                fusion_decision.can_fuse ? 'text-green-700' : 'text-orange-700'
              }`}>
                {result.action}
              </p>
            </div>
          </div>

          {/* Confidence Badge */}
          <div className={`px-3 py-1 rounded-full border font-semibold text-sm flex items-center gap-2 ${
            getConfidenceColor(fusion_decision.confidence_level)
          }`}>
            <span>{getConfidenceIcon(fusion_decision.confidence_level)}</span>
            <span>{fusion_decision.confidence_score}% Confidence</span>
            <span className="text-xs opacity-75">({fusion_decision.confidence_level})</span>
          </div>
        </div>

        {/* AI Explanation */}
        <div className="mt-3 p-3 bg-white rounded border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-700 text-sm">AI Analysis:</h4>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
          </div>
          {showDetails && (
            <p className="text-sm text-slate-600 leading-relaxed">
              {fusion_decision.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Source Items Display */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Document 1 Items */}
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">Doc 1</span>
            Selected Items ({doc1Selected.length})
          </h4>
          <div className="space-y-2">
            {doc1Selected.map((item, idx) => (
              <div key={idx} className="bg-white p-2 rounded border border-blue-200">
                <div className="text-xs font-semibold text-blue-800">{item.section}</div>
                <div className="text-sm text-slate-700 mt-1">{item.question}</div>
                {item.status && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {item.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Document 2 Items */}
        <div className="border border-red-200 rounded-lg p-3 bg-red-50">
          <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded">Doc 2</span>
            Selected Items ({doc2Selected.length})
          </h4>
          <div className="space-y-2">
            {doc2Selected.map((item, idx) => (
              <div key={idx} className="bg-white p-2 rounded border border-red-200">
                <div className="text-xs font-semibold text-red-800">{item.section}</div>
                <div className="text-sm text-slate-700 mt-1">{item.question}</div>
                {item.status && (
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                    {item.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fused Item Preview (if fusable) */}
      {fusion_decision.can_fuse && result.merged_item && (
        <div className="border-2 border-green-300 rounded-lg p-4 bg-white mb-4">
          <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">FUSED</span>
            Merged Item Preview
          </h4>
          
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-600">Section:</span>
              <div className="text-sm text-slate-800">{result.merged_item.section}</div>
            </div>
            
            <div>
              <span className="text-xs font-semibold text-slate-600">Question:</span>
              <div className="text-sm text-slate-800 font-medium">{result.merged_item.question}</div>
            </div>

            {result.merged_item.options && result.merged_item.options.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-600">Options:</span>
                <div className="mt-1 space-y-1">
                  {result.merged_item.options.map((option: any, idx: number) => (
                    <div key={idx} className="text-sm p-2 bg-slate-50 rounded border border-slate-200">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Source: <span className="font-semibold">{option.source}</span>
                        {option.original_doc1 && (
                          <span className="ml-2">• Doc1: "{option.original_doc1}"</span>
                        )}
                        {option.original_doc2 && (
                          <span className="ml-2">• Doc2: "{option.original_doc2}"</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.merged_item.notes && (
              <div>
                <span className="text-xs font-semibold text-slate-600">Notes:</span>
                <div className="text-sm text-slate-700 bg-yellow-50 p-2 rounded border border-yellow-200 mt-1">
                  {result.merged_item.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {fusion_decision.can_fuse ? (
          <>
            <button
              onClick={onAcceptFusion}
              className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition shadow-lg"
            >
              ✓ Accept & Continue
            </button>
            <button
              onClick={onManualFuse}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              ✎ Edit First
            </button>
            <button
              onClick={onKeepSeparate}
              className="px-6 py-3 bg-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-400 transition"
            >
              Keep Separate
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onManualFuse}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg"
            >
              ✎ Manual Fusion Editor
            </button>
            <button
              onClick={onKeepSeparate}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
            >
              ✓ Keep Separate
            </button>
          </>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-4 text-xs text-slate-400 text-center">
        Analyzed at {new Date(fusionResponse.metadata?.processed_at || Date.now()).toLocaleString()}
      </div>
    </div>
  )
}
