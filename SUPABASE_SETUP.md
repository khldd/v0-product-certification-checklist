# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - Project name: `certification-checklist`
   - Database password: (save this securely)
   - Region: Choose closest to your users
5. Wait for project to be created (~2 minutes)

## 2. Create the Database Table

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the contents of `supabase-setup.sql`
4. Click "Run" to execute the SQL
5. Verify the table was created in **Table Editor** → `checklist_cache`

## 3. Get Your API Keys

1. Go to **Project Settings** (gear icon) → **API**
2. Copy the following values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 4. Configure Environment Variables

1. Create a `.env.local` file in the project root:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

## 5. How It Works

### Cache Flow:
1. **User uploads PDF** → File hash is generated (SHA-256)
2. **Check cache** → Query Supabase for existing checklist with same hash
3. **Cache hit** ✅ → Load checklist instantly from database
4. **Cache miss** ❌ → Send PDF to n8n webhook for analysis
5. **Save result** → Store analyzed checklist in Supabase for future use

### Benefits:
- **Faster loading**: Cached checklists load instantly
- **Cost savings**: Avoid re-processing same PDFs
- **Offline capability**: Can work with previously analyzed documents
- **Version tracking**: Each unique PDF version is cached separately

## 6. Testing

1. Upload and analyze a PDF document
2. Check Supabase **Table Editor** → `checklist_cache` for the new row
3. Upload the **same PDF** again → Should load from cache (instant)
4. Check console logs for "✅ Doc found in cache!" message

## 7. Database Schema

```sql
checklist_cache
├── id (UUID, Primary Key)
├── file_hash (TEXT, Unique) - SHA-256 hash of file
├── file_name (TEXT) - Original filename
├── file_size (BIGINT) - File size in bytes
├── checklist_data (JSONB) - Parsed checklist items
├── metadata (JSONB) - Document metadata
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

## 8. Optional: Monitoring

View cached checklists in Supabase:
```sql
SELECT 
  file_name,
  file_size,
  created_at,
  jsonb_array_length(checklist_data) as item_count
FROM checklist_cache
ORDER BY created_at DESC;
```

## Troubleshooting

### Error: "Invalid API key"
- Check that `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart dev server after changing `.env.local`

### Error: "Table does not exist"
- Run the SQL from `supabase-setup.sql` in Supabase SQL Editor

### Cache not working
- Check browser console for Supabase errors
- Verify Row Level Security policies allow reads/writes
- Check Supabase project is active (not paused)
