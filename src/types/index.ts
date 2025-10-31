// Core Project Structure
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Project Settings
  settings: ProjectSettings;
  
  // Core Content
  story: Story;
  scenes: Scene[];
  characters: Character[];
  
  // Metadata
  metadata: ProjectMetadata;
  permissions: ProjectPermissions;
  budget: BudgetSettings;
}

// Story & Planning
export interface Story {
  id: string;
  originalIdea: string;
  generatedStory: string;
  targetRuntime: number; // seconds
  actualRuntime: number; // calculated
  tone: string;
  brandCues: string[];
  styleTokens: StyleToken[];
  rationale: string; // "Why this story?"
  aspectRatio: '16:9' | '9:16' | '1:1'; // Aspect ratio for all generations
}

// Scene Management
export interface Scene {
  id: string;
  storyId: string;
  order: number;
  name: string;
  description: string;
  type: SceneType; // 'establishing' | 'dialogue' | 'insert' | 'action' | 'montage'
  purpose: string; // "Why this scene?" - auto-filled
  duration: number; // target duration in seconds
  
  // Style & Continuity
  style: SceneStyle;
  wardrobe: WardrobeLock[];
  location: string;
  
  // Coverage Planning
  coverage: CoveragePlan;
  
  // Clips
  clips: Clip[];
  
  // Status
  status: SceneStatus;
  locked: boolean;
}

// Character Management
export interface Character {
  id: string;
  name: string;
  description: string;
  role: string; // 'protagonist' | 'antagonist' | 'supporting'
  
  // Face References
  faceRefs: FaceReference[];
  primaryFaceRef: string; // ID of main face ref
  
  // Wardrobe & Continuity
  wardrobe: WardrobeItem[];
  appearance: AppearanceDescription;
  
  // Usage Tracking
  usedInScenes: string[];
  usedInClips: string[];
  
  // Metadata
  createdAt: Date;
  lastUsed: Date;
}

// Face Reference System
export interface FaceReference {
  id: string;
  characterId: string;
  imageUrl: string;
  thumbnailUrl: string;
  uploadedAt: Date;
  validated: boolean; // User confirmed "Looks correct"
  quality: 'high' | 'medium' | 'low';
  metadata: {
    fileSize: number;
    dimensions: { width: number; height: number };
    checksum: string;
  };
}

// Clip Card System
export interface Clip {
  id: string;
  sceneId: string;
  order: number;
  name: string;
  
  // Content
  imagePrompt: string;
  videoPrompt: string;
  generatedImage?: string;
  generatedVideo?: string;
  
  // Duration & Quality
  duration: 5 | 10; // seconds
  quality: 'standard' | 'high' | 'premium';
  
  // Camera & Framing
  cameraPreset: CameraPreset;
  framing: string;
  
  // Characters
  characters: CharacterReference[];
  
  // Kling Elements
  klingElements: KlingElement[];
  
  // Generation Status
  status: ClipStatus;
  generationJob?: GenerationJob;
  
  // Cost & Budget
  costEstimate: number;
  actualCost: number;
  
  // Version Control
  version: number;
  history: ClipVersion[];
  locked: boolean;
  
  // Preview
  previewImage?: string;
  previewVideo?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastRendered: Date;
}

// Kling Elements Integration
export interface KlingElement {
  type: 'face_swap' | 'object_replace' | 'object_remove' | 'style_transfer';
  target: string;
  replacement?: string;
  parameters: Record<string, any>;
  applied: boolean;
  result?: string; // URL to result
}

// Camera Presets
export interface CameraPreset {
  id: string;
  name: string;
  description: string;
  prompt: string; // Compiled prompt for this preset
  examples: string[];
}

// Generation Jobs
export interface GenerationJob {
  id: string;
  clipId: string;
  type: 'image' | 'video' | 'preview';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  provider: 'openai' | 'fal_ai' | 'kling';
  model: string;
  version: string;
  
  // Request/Response
  request: any;
  response?: any;
  error?: string;
  
  // Retry Logic
  retryCount: number;
  maxRetries: number;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // seconds
  
  // Cost
  cost: number;
  
  // Webhook
  webhookUrl?: string;
  webhookDelivered: boolean;
}

// Timeline & Review
export interface Timeline {
  id: string;
  projectId: string;
  clips: TimelineClip[];
  comments: TimelineComment[];
  exports: TimelineExport[];
}

export interface TimelineClip {
  clipId: string;
  startTime: number; // seconds
  duration: number;
  track: number; // for multi-track editing
  locked: boolean;
}

export interface TimelineComment {
  id: string;
  clipId: string;
  timecode: number;
  author: string;
  comment: string;
  resolved: boolean;
  createdAt: Date;
}

// Export System
export interface TimelineExport {
  id: string;
  name: string;
  type: 'fcpxml' | 'aaf' | 'json';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  files: ExportFile[];
  manifest: ExportManifest;
  createdAt: Date;
}

export interface ExportFile {
  type: 'fcpxml' | 'proxy' | 'manifest' | 'reference';
  url: string;
  size: number;
  checksum: string;
}

export interface ExportManifest {
  projectId: string;
  version: string;
  generatedAt: Date;
  clips: ClipManifest[];
  characters: CharacterManifest[];
  models: ModelManifest[];
  totalCost: number;
}

// Budget & Governance
export interface BudgetSettings {
  projectId: string;
  softCap: number;
  hardCap: number;
  currentSpend: number;
  currency: string;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  id: string;
  type: 'soft_cap' | 'hard_cap' | 'unusual_spend';
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
}

// Permissions & Roles
export interface ProjectPermissions {
  owner: string;
  collaborators: Collaborator[];
  roles: Role[];
}

export interface Collaborator {
  userId: string;
  email: string;
  role: 'admin' | 'editor' | 'reviewer' | 'viewer';
  permissions: Permission[];
  addedAt: Date;
}

// Settings & Configuration
export interface ProjectSettings {
  defaultDuration: 5 | 10;
  defaultQuality: 'standard' | 'high' | 'premium';
  autoRetry: boolean;
  maxRetries: number;
  consentRequired: boolean;
  offlineMode: boolean;
}

// Style & Branding
export interface StyleToken {
  name: string;
  value: string;
  category: 'color' | 'lighting' | 'mood' | 'camera' | 'post';
  applied: boolean;
}

export interface SceneStyle {
  mood: string;
  lighting: string;
  colorPalette: string;
  cameraStyle: string;
  postProcessing: string[];
}

// Wardrobe & Continuity
export interface WardrobeLock {
  characterId: string;
  item: string;
  description: string;
  locked: boolean;
  appliedToClips: string[];
}

// Coverage Planning
export interface CoveragePlan {
  sceneId: string;
  requiredShots: ShotType[];
  completedShots: string[]; // clip IDs
  coverage: number; // percentage
}

// Additional Types
export type SceneType = 'establishing' | 'dialogue' | 'insert' | 'action' | 'montage';
export type SceneStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'locked';
export type ClipStatus = 'draft' | 'pending' | 'generating' | 'completed' | 'failed' | 'locked';
export type ShotType = 'wide' | 'medium' | 'close' | 'insert' | 'ots' | 'cutaway';

// Supporting Interfaces
export interface CharacterReference {
  characterId: string;
  role: string;
  faceRefId?: string;
}

export interface ClipVersion {
  version: number;
  imagePrompt: string;
  videoPrompt: string;
  createdAt: Date;
  changes: string[];
}

export interface WardrobeItem {
  id: string;
  name: string;
  description: string;
  locked: boolean;
}

export interface AppearanceDescription {
  age: string;
  gender: string;
  ethnicity: string;
  hair: string;
  eyes: string;
  build: string;
  distinctive: string[];
}

export interface ProjectMetadata {
  version: string;
  lastModified: Date;
  totalClips: number;
  totalDuration: number;
  totalCost: number;
}

export interface Role {
  name: string;
  permissions: Permission[];
}

export interface Permission {
  action: string;
  resource: string;
}

export interface ClipManifest {
  id: string;
  name: string;
  duration: number;
  cost: number;
  model: string;
  checksum: string;
}

export interface CharacterManifest {
  id: string;
  name: string;
  faceRefs: string[];
}

export interface ModelManifest {
  provider: string;
  model: string;
  version: string;
  cost: number;
}
