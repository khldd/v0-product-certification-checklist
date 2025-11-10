import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Only create client if credentials are provided
let supabaseClient: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey && 
    supabaseUrl !== 'https://your-project.supabase.co' && 
    supabaseAnonKey !== 'your-anon-key-here') {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  console.log('[Supabase] Client initialized')
} else {
  console.warn('[Supabase] Credentials not configured. Caching disabled. Add credentials to .env.local to enable.')
}

export const supabase = supabaseClient

// Database types
export interface ChecklistCache {
  id?: string
  file_hash: string
  file_name: string
  file_size: number
  checklist_data: any
  metadata: any
  created_at?: string
  updated_at?: string
}

/**
 * Generate a hash for a file to use as cache key
 */
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Check if checklist exists in cache
 */
export async function getChecklistFromCache(fileHash: string): Promise<ChecklistCache | null> {
  if (!supabase) {
    console.log('[Supabase] Cache disabled - credentials not configured')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('checklist_cache')
      .select('*')
      .eq('file_hash', fileHash)
      .single()

    if (error) {
      console.log('[Supabase] Cache miss or error:', error.message)
      return null
    }

    console.log('[Supabase] Cache hit for file:', data.file_name)
    return data
  } catch (err) {
    console.error('[Supabase] Error checking cache:', err)
    return null
  }
}

/**
 * Save checklist to cache
 */
export async function saveChecklistToCache(
  fileHash: string,
  fileName: string,
  fileSize: number,
  checklistData: any,
  metadata: any
): Promise<void> {
  if (!supabase) {
    console.log('[Supabase] Cache disabled - credentials not configured')
    return
  }

  try {
    const { error } = await supabase
      .from('checklist_cache')
      .upsert({
        file_hash: fileHash,
        file_name: fileName,
        file_size: fileSize,
        checklist_data: checklistData,
        metadata: metadata,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'file_hash'
      })

    if (error) {
      console.error('[Supabase] Error saving to cache:', error)
      throw error
    }

    console.log('[Supabase] Saved checklist to cache:', fileName)
  } catch (err) {
    console.error('[Supabase] Error saving checklist:', err)
    throw err
  }
}
