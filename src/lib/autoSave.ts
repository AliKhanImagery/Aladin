// Auto-save utility with debouncing
import { Project } from '@/types'
import { saveProject } from './db'

let saveTimeout: NodeJS.Timeout | null = null
let pendingSave: { project: Project; userId: string } | null = null
let isSaving = false

const DEBOUNCE_DELAY = 2000 // 2 seconds

/**
 * Queue a project save with debouncing
 * Multiple rapid calls will be batched into a single save
 * Returns a promise that resolves when the save is queued (not when it completes)
 */
export function queueAutoSave(project: Project, userId: string): Promise<void> {
  // Store the latest project state
  pendingSave = { project, userId }

  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  // Set new timeout
  saveTimeout = setTimeout(async () => {
    if (pendingSave && !isSaving) {
      isSaving = true
      const { project: projectToSave, userId: userIdToSave } = pendingSave
      pendingSave = null

      try {
        console.log('💾 Auto-saving project:', projectToSave.name)
        const result = await saveProject(projectToSave, userIdToSave)
        
        if (result.success) {
          console.log('✅ Auto-save successful')
        } else {
          console.error('❌ Auto-save failed:', result.error)
        }
      } catch (error) {
        console.error('❌ Auto-save exception:', error)
      } finally {
        isSaving = false
      }
    }
  }, DEBOUNCE_DELAY)
  
  return Promise.resolve()
}

/**
 * Immediately save a project (no debouncing)
 * Use this for critical operations like after generation completes
 */
export async function saveImmediately(project: Project, userId: string): Promise<{ success: boolean; lastSaved?: Date }> {
  // Clear any pending debounced save
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  pendingSave = null

  // If already saving, wait a bit and retry
  if (isSaving) {
    console.log('⏳ Auto-save in progress, waiting...')
    await new Promise(resolve => setTimeout(resolve, 500))
    if (isSaving) {
      // Still saving, queue it
      return queueAutoSave(project, userId) as any
    }
  }

  isSaving = true
  try {
    console.log('💾 Immediate save for project:', project.name)
    const result = await saveProject(project, userId)
    
    if (result.success) {
      console.log('✅ Immediate save successful')
    } else {
      console.error('❌ Immediate save failed:', result.error)
    }
    
    return result
  } catch (error) {
    console.error('❌ Immediate save exception:', error)
    return { success: false }
  } finally {
    isSaving = false
  }
}

/**
 * Clear any pending auto-save
 */
export function clearPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  pendingSave = null
}

