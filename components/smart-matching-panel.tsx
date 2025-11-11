"use client"

import { useState } from "react"
import { Sparkles, Loader2, X } from "lucide-react"
import { getConfidenceColor, getConfidenceBgColor } from "@/lib/utils"

interface MatchingSuggestion {
  doc1_item: any
  doc2_item: any
  similarity: number
  reason: string
}

interface SmartMatchingPanelProps {
  doc1Data: any
  doc2Data: any
  onSelectPair: (doc1Items: any[], doc2Items: any[]) => void
  disabled?: boolean
}

export default function SmartMatchingPanel({
  doc1Data,
  doc2Data,
  onSelectPair,
  disabled = false
}: SmartMatchingPanelProps) {
  const [suggestions, setSuggestions] = useState<MatchingSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  const generateSuggestions = async () => {
    setLoading(true)
    setError(null)

    try {
      // Extract all items from both documents
      const doc1Items = doc1Data?.checklist_unifiee || []
      const doc2Items = doc2Data?.checklist_unifiee || []

      if (doc1Items.length === 0 || doc2Items.length === 0) {
        setError("Both documents must have items to analyze")
        return
      }

      // Simple similarity matching based on text comparison
      // In a real implementation, this could call an AI service
      const matches: MatchingSuggestion[] = []

      // For now, we'll do a simple keyword-based matching
      // This is a placeholder - ideally this would call an n8n workflow
      doc1Items.slice(0, 10).forEach((item1: any) => {
        // Find best match in doc2
        let bestMatch: any = null
        let bestScore = 0

        doc2Items.forEach((item2: any) => {
          const score = calculateSimpleSimilarity(
            item1.question || item1.label || "",
            item2.question || item2.label || ""
          )

          if (score > bestScore && score > 0.3) {
            bestScore = score
            bestMatch = item2
          }
        })

        if (bestMatch) {
          matches.push({
            doc1_item: item1,
            doc2_item: bestMatch,
            similarity: Math.round(bestScore * 100),
            reason: generateMatchReason(item1, bestMatch, bestScore)
          })
        }
      })

      // Sort by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity)

      setSuggestions(matches.slice(0, 5)) // Top 5 matches
      setShowPanel(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate suggestions")
    } finally {
      setLoading(false)
    }
  }

  // Simple text similarity calculation
  const calculateSimpleSimilarity = (text1: string, text2: string): number => {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)

    const commonWords = words1.filter(word =>
      word.length > 3 && words2.includes(word)
    )

    const totalWords = Math.max(words1.length, words2.length)
    return commonWords.length / totalWords
  }

  const generateMatchReason = (item1: any, item2: any, score: number): string => {
    if (score > 0.7) return "Strong semantic similarity in questions"
    if (score > 0.5) return "Moderate overlap in content"
    if (score > 0.3) return "Some common keywords detected"
    return "Potential match based on context"
  }

  const handleSelectPair = (suggestion: MatchingSuggestion) => {
    onSelectPair([suggestion.doc1_item], [suggestion.doc2_item])
    setShowPanel(false)
  }

  if (!showPanel) {
    return (
      <button
        onClick={generateSuggestions}
        disabled={disabled || loading || !doc1Data || !doc2Data}
        className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
          disabled || loading || !doc1Data || !doc2Data
            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
            : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/30"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Suggest Matches
          </>
        )}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-50 border-b border-purple-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-bold text-purple-900">Smart Matching Suggestions</h2>
              <p className="text-sm text-purple-700">AI-powered pairing recommendations</p>
            </div>
          </div>
          <button
            onClick={() => setShowPanel(false)}
            className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-full p-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Suggestions List */}
        <div className="flex-1 overflow-auto p-6">
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-slate-400 mb-4">
                <Sparkles className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-slate-600 font-medium">No strong matches found</p>
              <p className="text-slate-400 text-sm mt-1">
                Try selecting items manually or uploading more similar documents
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-slate-50 rounded-lg border-2 border-slate-200 hover:border-purple-300 transition overflow-hidden"
                >
                  {/* Similarity Score Header */}
                  <div className={`px-4 py-2 flex items-center justify-between border-b ${getConfidenceBgColor(suggestion.similarity)}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${getConfidenceColor(suggestion.similarity)}`}>
                        {suggestion.similarity}%
                      </span>
                      <span className="text-sm text-slate-600">similarity</span>
                    </div>
                    <button
                      onClick={() => handleSelectPair(suggestion)}
                      className="px-4 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-semibold"
                    >
                      Select This Pair
                    </button>
                  </div>

                  {/* Items Comparison */}
                  <div className="p-4 grid grid-cols-2 gap-4">
                    {/* Doc 1 Item */}
                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                      <div className="text-xs font-semibold text-blue-800 mb-2">Document 1</div>
                      {suggestion.doc1_item.section && (
                        <div className="text-xs text-blue-700 mb-1 font-medium">
                          {suggestion.doc1_item.section}
                        </div>
                      )}
                      <div className="text-sm text-slate-700">
                        {suggestion.doc1_item.question || suggestion.doc1_item.label || "(No question)"}
                      </div>
                      {suggestion.doc1_item.status && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-300">
                            {suggestion.doc1_item.status}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Doc 2 Item */}
                    <div className="bg-red-50 p-3 rounded border border-red-200">
                      <div className="text-xs font-semibold text-red-800 mb-2">Document 2</div>
                      {suggestion.doc2_item.section && (
                        <div className="text-xs text-red-700 mb-1 font-medium">
                          {suggestion.doc2_item.section}
                        </div>
                      )}
                      <div className="text-sm text-slate-700">
                        {suggestion.doc2_item.question || suggestion.doc2_item.label || "(No question)"}
                      </div>
                      {suggestion.doc2_item.status && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded border border-red-300">
                            {suggestion.doc2_item.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="px-4 pb-3">
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <span className="text-xs font-semibold text-yellow-800">Match Reason: </span>
                      <span className="text-xs text-slate-600">{suggestion.reason}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <p className="text-xs text-slate-600 text-center">
            These are AI-generated suggestions. Review each pair carefully before processing.
          </p>
        </div>
      </div>
    </div>
  )
}
