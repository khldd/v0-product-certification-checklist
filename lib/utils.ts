import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Validation utilities for fusion responses

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface FusionResponse {
  success?: boolean
  timestamp?: string
  fusion_decision?: {
    can_fuse: boolean
    confidence_score: number
    confidence_level?: string
    should_auto_apply?: boolean
    explanation: string
  }
  result?: {
    status: string
    merged_item?: any
    action: string
  }
  metadata?: any
}

/**
 * Validates a fusion response from the n8n webhook
 */
export function validateFusionResponse(response: any): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if response is an object
  if (!response || typeof response !== 'object') {
    errors.push('Response is not a valid object')
    return { isValid: false, errors, warnings }
  }

  // Check for fusion_decision object (new format)
  if (!response.fusion_decision) {
    errors.push('Missing fusion_decision object')
  } else {
    const decision = response.fusion_decision

    // Validate required fields
    if (typeof decision.can_fuse !== 'boolean') {
      errors.push('fusion_decision.can_fuse must be a boolean')
    }

    if (typeof decision.confidence_score !== 'number') {
      errors.push('fusion_decision.confidence_score must be a number')
    } else if (decision.confidence_score < 0 || decision.confidence_score > 100) {
      errors.push('fusion_decision.confidence_score must be between 0 and 100')
    }

    if (!decision.explanation || typeof decision.explanation !== 'string') {
      errors.push('fusion_decision.explanation is required and must be a string')
    }

    // Check confidence level if present
    if (decision.confidence_level) {
      const validLevels = ['very_high', 'high', 'medium', 'low', 'very_low']
      if (!validLevels.includes(decision.confidence_level)) {
        warnings.push(`Invalid confidence_level: ${decision.confidence_level}`)
      }
    }
  }

  // Check for result object
  if (!response.result) {
    errors.push('Missing result object')
  } else {
    const result = response.result

    if (!result.status) {
      errors.push('result.status is required')
    }

    if (!result.action || typeof result.action !== 'string') {
      errors.push('result.action is required and must be a string')
    }

    // If can_fuse is true, merged_item should exist
    if (response.fusion_decision?.can_fuse && !result.merged_item) {
      warnings.push('can_fuse is true but merged_item is missing')
    }

    // Validate merged_item structure if present
    if (result.merged_item) {
      const item = result.merged_item

      if (!item.id || typeof item.id !== 'string') {
        errors.push('merged_item.id is required and must be a string')
      } else if (!item.id.startsWith('fusion.')) {
        warnings.push('merged_item.id should start with "fusion." prefix')
      }

      if (!item.question || typeof item.question !== 'string') {
        errors.push('merged_item.question is required and must be a string')
      } else if (item.question.length < 10) {
        warnings.push('merged_item.question seems too short')
      }

      // Check for source tracking
      if (!item.sources || !item.sources.doc1 || !item.sources.doc2) {
        warnings.push('merged_item is missing source tracking information (sources.doc1/doc2)')
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Gets a color class based on confidence score
 */
export function getConfidenceColor(score: number): string {
  if (score >= 90) return 'text-green-600 dark:text-green-400'
  if (score >= 75) return 'text-blue-600 dark:text-blue-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Gets a background color class based on confidence score
 */
export function getConfidenceBgColor(score: number): string {
  if (score >= 90) return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700'
  if (score >= 75) return 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
  if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
  return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700'
}

/**
 * Gets a readable confidence level description
 */
export function getConfidenceDescription(level: string): string {
  switch (level) {
    case 'very_high':
      return 'Very High Confidence'
    case 'high':
      return 'High Confidence'
    case 'medium':
      return 'Medium Confidence'
    case 'low':
      return 'Low Confidence'
    case 'very_low':
      return 'Very Low Confidence'
    default:
      return 'Unknown Confidence'
  }
}
