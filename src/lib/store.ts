import { create } from 'zustand'
import { Project, Scene, Clip, Character } from '@/types'

interface AppState {
  // User state
  user: any | null
  isAuthenticated: boolean
  
  // Project state
  currentProject: Project | null
  projects: Project[]
  
  // UI state
  activeTab: 'idea' | 'sequence' | 'timeline'
  selectedClip: Clip | null
  isDrawerOpen: boolean
  isProjectManagerOpen: boolean
  
  // Generation state
  isGeneratingStory: boolean
  generationStatus: string
  generationProgress: {
    totalScenes: number
    completedScenes: number
    totalClips: number
    completedClips: number
  }
  
  // Actions
  setUser: (user: any) => void
  setAuthenticated: (isAuth: boolean) => void
  setCurrentProject: (project: Project | null) => void
  setProjects: (projects: Project[]) => void
  setActiveTab: (tab: 'idea' | 'sequence' | 'timeline') => void
  setSelectedClip: (clip: Clip | null) => void
  setDrawerOpen: (open: boolean) => void
  setProjectManagerOpen: (open: boolean) => void
  setGeneratingStory: (isGenerating: boolean) => void
  setGenerationStatus: (status: string) => void
  setGenerationProgress: (progress: {
    totalScenes: number
    completedScenes: number
    totalClips: number
    completedClips: number
  }) => void
  
  // Project actions
  createProject: (project: Project) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void
  deleteProject: (projectId: string) => void
  
  // Scene actions
  addScene: (scene: Scene) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  deleteScene: (sceneId: string) => void
  
  // Clip actions
  addClip: (sceneId: string, clip: Clip) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  deleteClip: (clipId: string) => void
  
  // Character actions
  addCharacter: (character: Character) => void
  updateCharacter: (characterId: string, updates: Partial<Character>) => void
  deleteCharacter: (characterId: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  currentProject: null,
  projects: [],
  activeTab: 'idea',
  selectedClip: null,
  isDrawerOpen: false,
  isProjectManagerOpen: false,
  isGeneratingStory: false,
  generationStatus: '',
  generationProgress: {
    totalScenes: 0,
    completedScenes: 0,
    totalClips: 0,
    completedClips: 0
  },
  
  // User actions
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuth) => set({ isAuthenticated: isAuth }),
  
  // Project actions
  setCurrentProject: (project) => set({ currentProject: project }),
  setProjects: (projects) => set({ projects }),
  createProject: (project) => set((state) => ({
    projects: [...state.projects, project],
    currentProject: project
  })),
  updateProject: (projectId, updates) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId ? { ...p, ...updates } : p
    ),
    currentProject: state.currentProject?.id === projectId 
      ? { ...state.currentProject, ...updates }
      : state.currentProject
  })),
  deleteProject: (projectId) => set((state) => ({
    projects: state.projects.filter(p => p.id !== projectId),
    currentProject: state.currentProject?.id === projectId ? null : state.currentProject
  })),
  
  // Scene actions
  addScene: (scene) => set((state) => {
    if (!state.currentProject) {
      console.error('❌ addScene: No current project')
      return state
    }
    console.log('🔧 Store addScene called:', {
      sceneId: scene.id,
      sceneName: scene.name,
      currentScenesCount: state.currentProject.scenes.length,
      projectId: state.currentProject.id
    })
    const updatedProject = {
      ...state.currentProject,
      scenes: [...state.currentProject.scenes, scene]
    }
    console.log('✅ Store addScene: Updated project with', updatedProject.scenes.length, 'scenes')
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject.id ? updatedProject : p
      )
    }
  }),
  updateScene: (sceneId, updates) => set((state) => {
    if (!state.currentProject) return state
    return {
      currentProject: {
        ...state.currentProject,
        scenes: state.currentProject.scenes.map(s =>
          s.id === sceneId ? { ...s, ...updates } : s
        )
      }
    }
  }),
  deleteScene: (sceneId) => set((state) => {
    if (!state.currentProject) {
      console.error('❌ deleteScene: No current project')
      return state
    }
    console.log('🗑️ Store deleteScene called:', { sceneId })
    const updatedProject = {
      ...state.currentProject,
      scenes: state.currentProject.scenes.filter(s => s.id !== sceneId)
    }
    console.log('✅ Store deleteScene: Updated project with', updatedProject.scenes.length, 'scenes')
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === state.currentProject.id ? updatedProject : p
      )
    }
  }),
  
  // Clip actions
  addClip: (sceneId, clip) => set((state) => {
    if (!state.currentProject) {
      console.error('❌ addClip: No current project')
      return state
    }
    const scene = state.currentProject.scenes.find(s => s.id === sceneId)
    console.log('🔧 Store addClip called:', {
      sceneId,
      clipId: clip.id,
      clipName: clip.name,
      sceneFound: !!scene,
      currentClipsCount: scene?.clips?.length || 0
    })
    const updatedProject = {
      ...state.currentProject,
      scenes: state.currentProject.scenes.map(s =>
        s.id === sceneId 
          ? { ...s, clips: [...s.clips, clip] }
          : s
      )
    }
    const updatedScene = updatedProject.scenes.find(s => s.id === sceneId)
    console.log('✅ Store addClip: Scene now has', updatedScene?.clips?.length || 0, 'clips')
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject.id ? updatedProject : p
      )
    }
  }),
  updateClip: (clipId, updates) => set((state) => {
    if (!state.currentProject) return state
    return {
      currentProject: {
        ...state.currentProject,
        scenes: state.currentProject.scenes.map(s => ({
          ...s,
          clips: s.clips.map(c =>
            c.id === clipId ? { ...c, ...updates } : c
          )
        }))
      }
    }
  }),
  deleteClip: (clipId) => set((state) => {
    if (!state.currentProject) {
      console.error('❌ deleteClip: No current project')
      return state
    }
    console.log('🗑️ Store deleteClip called:', { clipId })
    const updatedProject = {
      ...state.currentProject,
      scenes: state.currentProject.scenes.map(s => {
        const updatedScene = {
          ...s,
          clips: s.clips.filter(c => c.id !== clipId)
        }
        if (s.clips.length !== updatedScene.clips.length) {
          console.log(`✅ Removed clip from scene ${s.id}. Scene now has ${updatedScene.clips.length} clips`)
        }
        return updatedScene
      })
    }
    // Clear selected clip if it was the one deleted
    const selectedClip = state.selectedClip
    if (selectedClip && selectedClip.id === clipId) {
      return {
        currentProject: updatedProject,
        projects: state.projects.map(p =>
          p.id === state.currentProject.id ? updatedProject : p
        ),
        selectedClip: null,
        isDrawerOpen: false
      }
    }
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === state.currentProject.id ? updatedProject : p
      )
    }
  }),
  
  // Character actions
  addCharacter: (character) => set((state) => {
    if (!state.currentProject) return state
    return {
      currentProject: {
        ...state.currentProject,
        characters: [...state.currentProject.characters, character]
      }
    }
  }),
  updateCharacter: (characterId, updates) => set((state) => {
    if (!state.currentProject) return state
    return {
      currentProject: {
        ...state.currentProject,
        characters: state.currentProject.characters.map(c =>
          c.id === characterId ? { ...c, ...updates } : c
        )
      }
    }
  }),
  deleteCharacter: (characterId) => set((state) => {
    if (!state.currentProject) return state
    return {
      currentProject: {
        ...state.currentProject,
        characters: state.currentProject.characters.filter(c => c.id !== characterId)
      }
    }
  }),
  
  // UI actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedClip: (clip) => set({ selectedClip: clip }),
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setProjectManagerOpen: (open) => set({ isProjectManagerOpen: open }),
  setGeneratingStory: (isGenerating) => set({ isGeneratingStory: isGenerating }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  setGenerationProgress: (progress) => set({ generationProgress: progress }),
}))
