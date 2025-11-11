"use client"

import { Loader2 } from "lucide-react"
import type { BatchProgress } from "@/hooks/useBatchFusion"

interface BatchProgressIndicatorProps {
  progress: BatchProgress
}

export function BatchProgressIndicator({ progress }: BatchProgressIndicatorProps) {
  if (progress.status === 'idle') {
    return null
  }

  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="w-full space-y-3 p-6">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {progress.status === 'processing' && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="font-medium">
            {progress.status === 'processing' && 'Processing...'}
            {progress.status === 'completed' && 'Complete!'}
            {progress.status === 'error' && 'Error'}
          </span>
        </div>
        <span className="text-muted-foreground">
          {progress.current} / {progress.total}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            progress.status === 'error'
              ? 'bg-destructive'
              : progress.status === 'completed'
              ? 'bg-green-500'
              : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Current Operation */}
      {progress.currentOperation && (
        <p className="text-sm text-muted-foreground">
          {progress.currentOperation}
        </p>
      )}

      {/* Percentage Display */}
      {progress.status === 'processing' && (
        <div className="text-center text-2xl font-bold text-primary">
          {percentage}%
        </div>
      )}
    </div>
  )
}
