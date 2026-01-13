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
 * Immediately save a project (no debouncing) with exponential backoff retry
 * Use this for critical operations like after generation completes
 */
export async function saveImmediately(
  project: Project, 
  userId: string,
  retryAttempt = 0
): Promise<{ success: boolean; lastSaved?: Date; error?: string }> {
  const maxRetries = 5
  const baseDelay = 1000 // 1 second base delay

  // Clear any pending debounced save
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  pendingSave = null

  // If already saving, wait a bit and retry (max 5 retries)
  let waitCount = 0
  const maxWaitRetries = 5
  while (isSaving && waitCount < maxWaitRetries) {
    console.log(`⏳ Auto-save in progress, waiting (wait ${waitCount + 1}/${maxWaitRetries})...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    waitCount++
  }

  if (isSaving) {
    console.warn('⚠️ Save still in progress after waits, falling back to queue')
      return queueAutoSave(project, userId) as any
  }

  isSaving = true
  try {
    console.log(`💾 Immediate save for project: ${project.name} (attempt ${retryAttempt + 1}/${maxRetries + 1})`)
    const result = await saveProject(project, userId)
    
    if (result.success) {
      console.log('✅ Immediate save successful', {
        projectId: project.id,
        attempts: retryAttempt + 1
      })
      isSaving = false
      return result
    } else {
      // Retry on failure with exponential backoff
      if (retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt) // 1s, 2s, 4s, 8s, 16s
        console.warn(`⚠️ Immediate save failed, retrying in ${delay}ms...`, {
          error: result.error,
          attempt: retryAttempt + 1
        })
        isSaving = false
        await new Promise(resolve => setTimeout(resolve, delay))
        return saveImmediately(project, userId, retryAttempt + 1)
      }
      
      console.error('❌ Immediate save failed after all retries:', result.error)
      isSaving = false
      return { 
        success: false, 
        error: result.error || 'Save failed after all retries'
      }
    }
  } catch (error: any) {
    console.error(`❌ Immediate save exception (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, {
      message: error?.message,
      name: error?.name
    })
    
    // Retry on exceptions
    if (retryAttempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryAttempt)
      console.log(`🔄 Retrying after exception in ${delay}ms...`)
      isSaving = false
      await new Promise(resolve => setTimeout(resolve, delay))
      return saveImmediately(project, userId, retryAttempt + 1)
    }
    
    isSaving = false
    return { 
      success: false, 
      error: error?.message || 'Save exception after all retries'
    }
  }
}

/**
 * Critical save function - retries until success or max attempts
 * Use for must-succeed saves (projects, clips after generation)
 */
export async function saveCritical(
  project: Project,
  userId: string
): Promise<{ success: boolean; lastSaved?: Date; error?: string }> {
  const maxAttempts = 10 // More attempts for critical saves
  let lastError: string | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await saveImmediately(project, userId, attempt)
    
    if (result.success) {
      console.log(`✅ Critical save succeeded on attempt ${attempt + 1}`)
      return result
    }
    
    lastError = result.error
    if (attempt < maxAttempts - 1) {
      const delay = 1000 * Math.pow(2, attempt) // Exponential backoff
      console.warn(`⚠️ Critical save attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  console.error(`❌ CRITICAL: Save failed after ${maxAttempts} attempts - data may be lost!`, {
    projectId: project.id,
    error: lastError
  })
  
  return {
    success: false,
    error: lastError || `Failed after ${maxAttempts} attempts`
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

