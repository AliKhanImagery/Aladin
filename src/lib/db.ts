import { supabase } from './supabase'
import { Project } from '@/types'

// Load projects for current user
export async function loadUserProjects(userId: string): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('created_by', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    // Transform database format to app format
    return (data || []).map(project => ({
      id: project.id,
      name: project.name,
      description: project.description || '',
      createdAt: new Date(project.created_at),
      updatedAt: new Date(project.updated_at),
      createdBy: project.created_by,
      settings: project.settings || {},
      story: project.story || {},
      scenes: project.scenes || [],
      characters: project.characters || [],
      metadata: project.metadata || {},
      permissions: project.permissions || {},
      budget: project.budget || {},
    })) as Project[]
  } catch (error) {
    console.error('Error loading projects:', error)
    return []
  }
}

// Save project to database
export async function saveProject(project: Project, userId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const projectData = {
      id: project.id,
      name: project.name,
      description: project.description,
      created_by: userId,
      settings: project.settings,
      story: project.story,
      scenes: project.scenes,
      characters: project.characters,
      metadata: project.metadata,
      permissions: project.permissions,
      budget: project.budget,
      updated_at: new Date().toISOString(),
    }

    // Check if project exists
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project.id)
      .single()

    if (existing) {
      // Update existing project
      const { error } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', project.id)

      if (error) throw error
    } else {
      // Insert new project
      const { error } = await supabase
        .from('projects')
        .insert(projectData)

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving project:', error)
    return { success: false, error }
  }
}

// Delete project
export async function deleteProject(projectId: string, userId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('created_by', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { success: false, error }
  }
}
