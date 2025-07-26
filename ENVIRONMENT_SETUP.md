# Environment Setup Guide

This guide helps you configure the IELTS Platform for production use.

## 🎭 Demo Mode vs Production Mode

The application automatically detects your configuration and runs in the appropriate mode:

### Demo Mode (Default)

- **Triggers when**: Supabase environment variables are missing or invalid
- **Features**:
  - Simulated authentication (demo@example.com / demo123)
  - Local file storage simulation
  - No real database connections
  - No network requests to Supabase

### Production Mode

- **Triggers when**: Valid Supabase configuration is provided
- **Features**:
  - Real authentication with Supabase
  - Cloud database storage
  - Multi-user support
  - File uploads to Supabase Storage

## 🔧 Configuration Steps

### 1. Create Environment File

Create a `.env.local` file in your project root:

```bash
# Copy the example file
cp .env.example .env.local
```

### 2. Get Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select existing
3. Go to Settings → API
4. Copy your:
   - Project URL
   - Anon (public) key

### 3. Configure Environment Variables

Edit `.env.local`:

```env
# Required for production mode
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional configurations
VITE_APP_TITLE="Your IELTS Platform"
VITE_APP_ENV=production
```

### 4. Database Setup

Run the database setup script:

```bash
# Connect to your Supabase database
psql -h db.your-project-id.supabase.co -U postgres -d postgres -f database_setup.sql

# Apply any schema fixes
psql -h db.your-project-id.supabase.co -U postgres -d postgres -f fix_listening_questions_schema.sql
```

### 5. Restart Development Server

```bash
npm run dev
```

## 🚨 Troubleshooting

### "Failed to fetch" Errors

If you see `TypeError: Failed to fetch` or `AuthRetryableFetchError`:

1. **Check your environment variables**:

   ```bash
   echo $VITE_SUPABASE_URL
   echo $VITE_SUPABASE_ANON_KEY
   ```

2. **Verify Supabase project status**:

   - Ensure your Supabase project is active
   - Check that the URL is correct
   - Verify the anon key is valid

3. **Test connection**:
   ```bash
   curl -H "apikey: YOUR_ANON_KEY" https://your-project-id.supabase.co/rest/v1/
   ```

### Demo Mode Stuck

If the app stays in demo mode:

1. **Check configuration detection**:

   - Open browser console
   - Look for "Demo mode detected" or "Using real Supabase configuration"

2. **Verify environment file**:

   ```bash
   cat .env.local
   ```

3. **Restart development server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Network/CORS Issues

If you encounter CORS or network errors:

1. **Check Supabase project settings**:

   - Go to Authentication → Settings
   - Add your domain to "Site URL"
   - Add your domain to "Redirect URLs"

2. **Disable browser extensions**:

   - Some extensions can interfere with requests
   - Try in incognito mode

3. **Check firewall/proxy settings**:
   - Ensure Supabase domains are accessible
   - Check corporate proxy settings

## 📊 Verification

### Check Current Mode

Open browser console and look for:

**Demo Mode**:

```
🎭 Demo mode detected - skipping authentication
⚠️ DEMO MODE: Supabase configuration missing or invalid
```

**Production Mode**:

```
✅ Using real Supabase configuration
🔗 Supabase URL: https://your-project-id.supabase.co
🔑 Supabase Key (first 20 chars): eyJhbGciOiJIUzI1NiIsI...
```

### Test Authentication

**Demo Mode**:

- Email: `demo@example.com`
- Password: `demo123`

**Production Mode**:

- Use real user credentials
- Create account through signup

## 🔒 Security Notes

- Never commit `.env.local` to version control
- Keep your Supabase anon key secure (it's safe for client-side use)
- Use Row Level Security (RLS) policies in Supabase
- Set up proper authentication redirects

## 🚀 Deployment

When deploying to production:

1. **Set environment variables** in your hosting platform
2. **Update Supabase settings** with your production domain
3. **Test authentication flow** thoroughly
4. **Monitor error logs** for any configuration issues

For detailed deployment guides, see the main [README.md](README.md).
