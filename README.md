# StoryFlow AI

**From Idea to Frame** – AI-powered storyboard to video generation

## 🚀 Quick Start

1. **Copy environment variables:**
   ```bash
   cp env.example .env.local
   ```

2. **Fill in your API keys in `.env.local`:**
   - Get Supabase URL and key from [supabase.com](https://supabase.com)
   - Get OpenAI API key from [platform.openai.com](https://platform.openai.com)
   - Get Fal AI key from [fal.ai](https://fal.ai)

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Open `http://localhost:3000`**

## 🎬 Features

- **Idea to Storyboard**: Transform text ideas into visual storyboards
- **Character Management**: Upload face references for consistent characters
- **Video Generation**: Generate clips using Kling AI via Fal AI
- **Timeline & SFX**: Add lipsync and sound effects
- **Project Management**: Save and manage multiple projects

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI (story generation) + Fal AI (video generation)
- **Deployment**: Vercel

## 📁 Project Structure

```
src/
├── app/                 # Next.js app router
├── components/          # Reusable UI components
├── lib/                 # Utilities and configurations
├── types/               # TypeScript type definitions
└── hooks/               # Custom React hooks
```

## Branch overview: how this version differs from `main`

This branch represents an evolved version of StoryFlow AI compared to the original `main` on GitHub. Key differences:

- **Idea analysis & story pipeline**
  - New `/api/analyze-idea-preview` endpoint and `IdeaAnalysisScreen` to analyze ideas before full story generation.
  - Refined `/api/generate-story` and `/api/generate-clip-prompts` to produce more structured stories and production‑ready prompts.

- **User media library**
  - New pages `my-images`, `my-videos`, and `my-projects` for browsing generated assets and projects.
  - New Supabase tables and migration (`002_user_media_tables.sql`) plus helper libs (`userMedia`, `supabaseStorage`) for storing images/videos per user.
  - Upload endpoints (`/api/upload-avatar`, `/api/user/images`, `/api/user/videos`) for managing user media.

- **Auth & profile UX**
  - Enhanced `AuthModal`, `AuthProvider`, and reset‑password flow.
  - New `ProfileSettingsModal` and avatar upload support, integrated with Supabase auth.

- **Project & UI improvements**
  - Updated `MainApp`, `ProjectManager`, and tab layout (Idea / Sequence / Timeline & SFX) for a clearer end‑to‑end workflow.
  - `ClipDetailDrawer`, `TimelineTab`, and `SequenceTab` tuned for better generation status, error handling, and debugging logs.

- **Docs & setup**
  - Added `SUPABASE_STORAGE_SETUP.md` and `TROUBLESHOOTING_MEDIA_AND_AUTH.md` with detailed guidance for storage and auth issues.
  - New `.github` configuration to guide AI/code tools working in this repo.

If you are a new contributor, assume this branch is the **current working baseline** and treat the GitHub `main` as the historical reference. When in doubt:

- Check the `/supabase/migrations` folder for schema differences.
- Review the `/src/app/api` routes to understand the latest AI and media flows.
- Use the new documentation files for environment and Supabase setup.
