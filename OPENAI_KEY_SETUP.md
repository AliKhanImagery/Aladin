# OpenAI API Key Setup Guide

## Issue Diagnosis

The application requires an OpenAI API key to function. If you're seeing 500 errors when trying to generate stories or analyze ideas, it's likely because the `OPENAI_API_KEY` environment variable is not set or configured incorrectly.

## Quick Fix

1. **Create or edit `.env.local` file** in the root directory of the project:
   ```bash
   touch .env.local
   ```

2. **Add your OpenAI API key** to `.env.local`:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```
   
   ⚠️ **Important**: Replace `sk-your-openai-api-key-here` with your actual OpenAI API key.

3. **Get your OpenAI API key**:
   - Go to https://platform.openai.com/api-keys
   - Sign in or create an account
   - Click "Create new secret key"
   - Copy the key (it starts with `sk-`)
   - Paste it in your `.env.local` file

4. **Restart the development server**:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

## File Location

The `.env.local` file should be in the root directory:
```
StoryFlowAI - flowboardAI/
  ├── .env.local          ← Your API keys go here
  ├── package.json
  ├── src/
  └── ...
```

## Verification

After setting up the key and restarting the server, you should see:
- No "OpenAI API key not configured" errors in the console
- The "Generate Story Structure" button should work
- API calls to `/api/analyze-idea-preview` should succeed

## Security Notes

- ✅ `.env.local` is already in `.gitignore` - your keys won't be committed to git
- ❌ Never commit your API keys to version control
- ❌ Never share your API keys publicly
- ✅ Use `.env.local` for local development
- ✅ Use environment variables in production (Vercel, etc.)

## Common Issues

### Issue: "OpenAI API key not configured"
**Solution**: Make sure `OPENAI_API_KEY` is set in `.env.local` and the server has been restarted.

### Issue: "OpenAI API authentication failed"
**Solution**: Your API key is invalid or expired. Generate a new key from https://platform.openai.com/api-keys

### Issue: "Rate limit exceeded"
**Solution**: You've hit your OpenAI API usage limit. Wait a moment or check your OpenAI billing/usage.

### Issue: Server not picking up changes
**Solution**: Restart the development server after modifying `.env.local` files.

## Example .env.local File

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890

# Supabase Configuration (if needed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Fal AI Configuration (if needed)
FAL_KEY=your-fal-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Next Steps

1. Set up your OpenAI API key as described above
2. Restart the development server
3. Try generating a story structure again
4. Check the browser console and server logs for any errors


