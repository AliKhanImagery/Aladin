# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Note your project URL and anon key

## 2. Set Environment Variables

Add to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Run Database Migration

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click "Run" to execute the migration

This will create:
- `users` table (extends auth.users)
- `projects` table (stores all project data)
- Row Level Security (RLS) policies
- Automatic triggers for user creation and timestamps

## 4. Verify Setup

- Check that the `users` table exists
- Check that the `projects` table exists
- Verify RLS policies are enabled
- Test authentication in your app

## 5. Database Schema

### Users Table
- `id` (UUID, primary key, references auth.users)
- `email` (TEXT, unique)
- `full_name` (TEXT)
- `avatar_url` (TEXT)
- `created_at`, `updated_at` (timestamps)

### Projects Table
- `id` (UUID, primary key)
- `name`, `description` (TEXT)
- `created_by` (UUID, references users)
- `created_at`, `updated_at` (timestamps)
- `settings`, `story`, `scenes`, `characters`, `metadata`, `permissions`, `budget` (JSONB)

All data is stored per user with RLS ensuring users can only access their own projects.
