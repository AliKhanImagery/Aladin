import { create } from 'zustand'
import { Project, Scene, Clip, Character, IdeaAnalysis, AssetContext, AssetActionState, AudioTrack, AudioClip } from '@/types'
import { queueAutoSave, saveImmediately } from './autoSave'

interface AppState {
  // User state
  user: any | null
  isAuthenticated: boolean
  
  // Project state
  currentProject: Project | null
  projects: Project[]
  projectLastSaved: Record<string, Date> // Track last saved time per project
  
  // UI state
  activeTab: 'idea' | 'sequence' | 'timeline'
  selectedClip: Clip | null
  isDrawerOpen: boolean
  drawerMode: 'visualize' | 'animate' | 'dub' | null // New field
  isProjectManagerOpen: boolean
  
  // Audio Drawer State
  isAudioDrawerOpen: boolean
  activeAudioTrackId: string | null
  activeAudioTime: number | null

  showAuthModal: boolean
  showProfileSettingsModal: boolean
  profileModalTab: 'profile' | 'connections'
  pendingIdea: string | null // Store idea when user needs to auth before creating
  
  // Generation state
  isGeneratingStory: boolean
  generationStatus: string
  generationProgress: {
    totalScenes: number
    completedScenes: number
    totalClips: number
    completedClips: number
  }
  // Per-clip generation status: { clipId: 'image' | 'video' | null }
  clipGeneratingStatus: Record<string, 'image' | 'video' | null>
  
  // Analysis state
  ideaAnalysis: IdeaAnalysis | null
  analysisScreenState: {
    settings: {
      tone: string[]
      brandCues: string[]
      type: string
      confirmed: boolean
    }
    assets: AssetActionState[]
  } | null
  
  // Actions
  setUser: (user: any) => void
  setAuthenticated: (isAuth: boolean) => void
  setCurrentProject: (project: Project | null) => void
  setProjects: (projects: Project[]) => void
  setActiveTab: (tab: 'idea' | 'sequence' | 'timeline') => void
  setSelectedClip: (clip: Clip | null) => void
  setDrawerOpen: (open: boolean, mode?: 'visualize' | 'animate' | 'dub') => void // Updated signature
  setProjectManagerOpen: (open: boolean) => void
  
  // Audio Drawer Actions
  setAudioDrawerOpen: (open: boolean, trackId?: string, time?: number) => void

  setShowAuthModal: (open: boolean) => void
  setShowProfileSettingsModal: (open: boolean, tab?: 'profile' | 'connections') => void
  setPendingIdea: (idea: string | null) => void
  setGeneratingStory: (isGenerating: boolean) => void
  setGenerationStatus: (status: string) => void
  setGenerationProgress: (progress: {
    totalScenes: number
    completedScenes: number
    totalClips: number
    completedClips: number
  }) => void
  setClipGeneratingStatus: (clipId: string, status: 'image' | 'video' | null) => void
  
  // Analysis actions
  setIdeaAnalysis: (analysis: IdeaAnalysis | null) => void
  setAnalysisScreenState: (state: {
    settings: {
      tone: string[]
      brandCues: string[]
      type: string
      confirmed: boolean
    }
    assets: AssetActionState[]
  } | null) => void
  updateAnalysisSettings: (settings: {
    tone: string[]
    brandCues: string[]
    type: string
    confirmed: boolean
  }) => void
  updateAssetAction: (assetId: string, action: 'upload' | 'generate' | 'remix' | 'auto' | null, data?: Partial<AssetActionState>) => void
  clearAnalysisState: () => void
  
  // Project actions
  createProject: (project: Project) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void
  deleteProject: (projectId: string) => void
  saveProjectNow: (projectId: string, immediate?: boolean) => Promise<void> // Manual save trigger
  
  // Scene actions
  addScene: (scene: Scene) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  deleteScene: (sceneId: string) => void
  
  // Clip actions
  addClip: (sceneId: string, clip: Clip) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  deleteClip: (clipId: string) => void
  reorderClips: (sceneId: string, fromIndex: number, toIndex: number) => void
  
  // Character actions
  addCharacter: (character: Character) => void
  updateCharacter: (characterId: string, updates: Partial<Character>) => void
  deleteCharacter: (characterId: string) => void

  // Audio actions
  addAudioTrack: (track: AudioTrack) => void
  updateAudioTrack: (trackId: string, updates: Partial<AudioTrack>) => void
  deleteAudioTrack: (trackId: string) => void
  addAudioClip: (trackId: string, clip: AudioClip) => void
  updateAudioClip: (trackId: string, clipId: string, updates: Partial<AudioClip>) => void
  deleteAudioClip: (trackId: string, clipId: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  currentProject: null,
  projects: [],
  projectLastSaved: {},
  activeTab: 'idea',
  selectedClip: null,
  isDrawerOpen: false,
  drawerMode: null,
  isProjectManagerOpen: false,
  isAudioDrawerOpen: false,
  activeAudioTrackId: null,
  activeAudioTime: null,
  showAuthModal: false,
  showProfileSettingsModal: false,
  profileModalTab: 'profile',
  pendingIdea: null,
  isGeneratingStory: false,
  generationStatus: '',
  generationProgress: {
    totalScenes: 0,
    completedScenes: 0,
    totalClips: 0,
    completedClips: 0
  },
  clipGeneratingStatus: {},
  ideaAnalysis: null,
  analysisScreenState: null,
  
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
  updateProject: (projectId, updates) => set((state) => {
    const updatedProject = state.currentProject?.id === projectId 
      ? { ...state.currentProject, ...updates, updatedAt: new Date() }
      : state.currentProject
    
    const updatedProjects = state.projects.map(p => 
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date() } : p
    )

    // Auto-save if user is authenticated and project exists
    if (state.isAuthenticated && state.user?.id && updatedProject) {
      queueAutoSave(updatedProject, state.user.id)
    }

    return {
      projects: updatedProjects,
      currentProject: updatedProject
    }
  }),
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
        updatedAt: new Date(),
        scenes: [...state.currentProject.scenes, scene]
      }
    console.log('✅ Store addScene: Updated project with', updatedProject.scenes.length, 'scenes')
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    const projectId = state.currentProject.id
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === projectId ? updatedProject : p
      )
    }
  }),
  updateScene: (sceneId, updates) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      scenes: state.currentProject.scenes.map(s =>
        s.id === sceneId ? { ...s, ...updates } : s
      )
    }

    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }

    const projectId = state.currentProject.id
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === projectId ? updatedProject : p
      )
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
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    const projectId = state.currentProject.id
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === projectId ? updatedProject : p
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
        updatedAt: new Date(),
        scenes: state.currentProject.scenes.map(s =>
          s.id === sceneId 
            ? { ...s, clips: [...s.clips, clip] }
            : s
        )
      }
    const updatedScene = updatedProject.scenes.find(s => s.id === sceneId)
    console.log('✅ Store addClip: Scene now has', updatedScene?.clips?.length || 0, 'clips')
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),
  updateClip: (clipId, updates) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      scenes: state.currentProject.scenes.map(s => ({
        ...s,
        clips: s.clips.map(c =>
          c.id === clipId ? { ...c, ...updates } : c
        )
      }))
    }

    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }

    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
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
        updatedAt: new Date(),
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
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    // Clear selected clip if it was the one deleted
    const selectedClip = state.selectedClip
    if (selectedClip && selectedClip.id === clipId) {
      return {
        currentProject: updatedProject,
        projects: state.projects.map(p =>
          p.id === state.currentProject!.id ? updatedProject : p
        ),
        selectedClip: null,
        isDrawerOpen: false
      }
    }
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  reorderClips: (sceneId, fromIndex, toIndex) => set((state) => {
    if (!state.currentProject) return state
    const scene = state.currentProject.scenes.find(s => s.id === sceneId)
    if (!scene || fromIndex === toIndex) return state
    const clips = [...scene.clips]
    if (fromIndex < 0 || fromIndex >= clips.length || toIndex < 0 || toIndex >= clips.length) return state
    const [removed] = clips.splice(fromIndex, 1)
    clips.splice(toIndex, 0, removed)
    const reorderedWithOrder = clips.map((c, i) => ({ ...c, order: i }))
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      scenes: state.currentProject.scenes.map(s =>
        s.id === sceneId ? { ...s, clips: reorderedWithOrder } : s
      )
    }
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p =>
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),
  
  // Character actions
  addCharacter: (character) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      characters: [...state.currentProject.characters, character]
    }
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),
  updateCharacter: (characterId, updates) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      characters: state.currentProject.characters.map(c =>
        c.id === characterId ? { ...c, ...updates } : c
      )
    }
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),
  deleteCharacter: (characterId) => set((state) => {
    if (!state.currentProject) return state
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      characters: state.currentProject.characters.filter(c => c.id !== characterId)
    }
    
    // Auto-save if user is authenticated
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  // Audio actions
  addAudioTrack: (track) => set((state) => {
    if (!state.currentProject) return state
    
    // Initialize timeline if it doesn't exist
    const timeline = state.currentProject.timeline || {
      id: `timeline-${state.currentProject.id}`,
      projectId: state.currentProject.id,
      clips: [],
      audioTracks: [],
      comments: [],
      exports: []
    }
    
    const updatedTimeline = {
      ...timeline,
      audioTracks: [...(timeline.audioTracks || []), track]
    }
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      timeline: updatedTimeline
    }
    
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  updateAudioTrack: (trackId, updates) => set((state) => {
    if (!state.currentProject || !state.currentProject.timeline) return state
    
    const updatedTimeline = {
      ...state.currentProject.timeline,
      audioTracks: state.currentProject.timeline.audioTracks.map(t =>
        t.id === trackId ? { ...t, ...updates } : t
      )
    }
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      timeline: updatedTimeline
    }
    
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  deleteAudioTrack: (trackId) => set((state) => {
    if (!state.currentProject || !state.currentProject.timeline) return state
    
    const updatedTimeline = {
      ...state.currentProject.timeline,
      audioTracks: state.currentProject.timeline.audioTracks.filter(t => t.id !== trackId)
    }
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      timeline: updatedTimeline
    }
    
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  addAudioClip: (trackId, clip) => set((state) => {
    if (!state.currentProject || !state.currentProject.timeline) return state
    
    const updatedTimeline = {
      ...state.currentProject.timeline,
      audioTracks: state.currentProject.timeline.audioTracks.map(t =>
        t.id === trackId 
          ? { ...t, clips: [...t.clips, clip] }
          : t
      )
    }
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      timeline: updatedTimeline
    }
    
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  updateAudioClip: (trackId, clipId, updates) => set((state) => {
    if (!state.currentProject || !state.currentProject.timeline) return state
    
    const updatedTimeline = {
      ...state.currentProject.timeline,
      audioTracks: state.currentProject.timeline.audioTracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map(c =>
                c.id === clipId ? { ...c, ...updates } : c
              )
            }
          : t
      )
    }
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      timeline: updatedTimeline
    }
    
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),

  deleteAudioClip: (trackId, clipId) => set((state) => {
    if (!state.currentProject || !state.currentProject.timeline) return state
    
    const updatedTimeline = {
      ...state.currentProject.timeline,
      audioTracks: state.currentProject.timeline.audioTracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.filter(c => c.id !== clipId)
            }
          : t
      )
    }
    
    const updatedProject = {
      ...state.currentProject,
      updatedAt: new Date(),
      timeline: updatedTimeline
    }
    
    if (state.isAuthenticated && state.user?.id) {
      queueAutoSave(updatedProject, state.user.id)
    }
    
    return {
      currentProject: updatedProject,
      projects: state.projects.map(p => 
        p.id === state.currentProject!.id ? updatedProject : p
      )
    }
  }),
  
  // Analysis actions
  setIdeaAnalysis: (analysis) => set({ ideaAnalysis: analysis }),
  setAnalysisScreenState: (state) => set({ analysisScreenState: state }),
  updateAnalysisSettings: (settings) => set((state) => ({
    analysisScreenState: state.analysisScreenState ? {
      ...state.analysisScreenState,
      settings
    } : null
  })),
  updateAssetAction: (assetId, action, data) => set((state) => {
    if (!state.analysisScreenState) return state
    
    const updatedAssets = state.analysisScreenState.assets.map(asset =>
      asset.assetId === assetId
        ? { ...asset, action, ...data }
        : asset
    )
    
    return {
      analysisScreenState: {
        ...state.analysisScreenState,
        assets: updatedAssets
      }
    }
  }),
  clearAnalysisState: () => set({
    ideaAnalysis: null,
    analysisScreenState: null
  }),
  
  // UI actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedClip: (clip) => set({ selectedClip: clip }),
  setDrawerOpen: (open, mode) => set({ isDrawerOpen: open, drawerMode: mode || null }),
  setProjectManagerOpen: (open) => set({ isProjectManagerOpen: open }),
  setAudioDrawerOpen: (open, trackId, time) => set({ 
    isAudioDrawerOpen: open,
    activeAudioTrackId: trackId || null,
    activeAudioTime: time !== undefined ? time : null
  }),
  setShowAuthModal: (open) => set({ showAuthModal: open }),
  setShowProfileSettingsModal: (open, tab) => set({ 
    showProfileSettingsModal: open,
    profileModalTab: tab || 'profile' 
  }),
  setPendingIdea: (idea) => set({ pendingIdea: idea }),
  setGeneratingStory: (isGenerating) => set({ isGeneratingStory: isGenerating }),
  setGenerationStatus: (status) => set({ generationStatus: status }),
  setGenerationProgress: (progress) => set({ generationProgress: progress }),
  setClipGeneratingStatus: (clipId, status) => set((state) => {
    const newStatus = { ...state.clipGeneratingStatus }
    if (status === null) {
      // Remove the key entirely when clearing status
      delete newStatus[clipId]
    } else {
      // Set the status when generating
      newStatus[clipId] = status
    }
    return { clipGeneratingStatus: newStatus }
  }),
  
  // Manual save trigger (for immediate saves after critical operations)
  saveProjectNow: async (projectId, immediate = false) => {
    const state = get()
    const project = state.currentProject?.id === projectId 
      ? state.currentProject 
      : state.projects.find(p => p.id === projectId)
    
    if (!project) {
      const error = new Error(`Project not found: ${projectId}`)
      console.error('❌ Cannot save project:', error)
      throw error
    }
    
    if (!state.isAuthenticated || !state.user?.id) {
      const error = new Error('User not authenticated - cannot save project')
      console.error('❌ Cannot save project:', error)
      throw error
    }

    try {
      const result = immediate 
        ? await saveImmediately(project, state.user.id)
        : await queueAutoSave(project, state.user.id) as any

      if (result?.success && result?.lastSaved) {
        set((state) => ({
          projectLastSaved: {
            ...state.projectLastSaved,
            [projectId]: result.lastSaved
          }
        }))
        return result
      } else if (result?.success === false) {
        // Save failed - throw error with details
        const error = new Error(result.error?.message || 'Project save failed')
        console.error('❌ Project save failed:', {
          projectId,
          error: result.error,
          message: error.message
        })
        throw error
      } else if (!immediate) {
        // For queued saves, we don't get a result immediately
        // Return a promise that resolves when save completes
        return { success: true }
      }
      
      return result
    } catch (error: any) {
      console.error('❌ Error in saveProjectNow:', {
        projectId,
        error: error.message,
        stack: error.stack
      })
      throw error // Re-throw so caller can handle it
    }
  },
}))