# 🚨 CRITICAL: Run This SQL First!

## The Professor Lock page won't work until you run this SQL in Supabase

### Steps:

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Click on your project** (iriaegoipkjtktitpary)
3. **Click "SQL Editor"** in the left sidebar
4. **Click "New Query"**
5. **Copy the ENTIRE contents** of this file:
   ```
   database/migrations/20250929_professor_lock_schema.sql
   ```
6. **Paste into the SQL Editor**
7. **Click "Run"** (or press Cmd/Ctrl + Enter)

### What This Does:
- Creates `professor_lock_sessions` table
- Creates `professor_lock_messages` table  
- Creates `professor_lock_events` table
- Creates `professor_lock_artifacts` table
- Sets up RLS policies for security
- Creates storage bucket for screenshots

### After Running:
- Go to `/professor-lock` on your site
- Click "Start Session"
- It should work without 500 error!
- Chat input will become enabled
- You can send messages (they'll be stored in DB)

---

**Current Error**: `Failed to create professor lock session`  
**Cause**: Tables don't exist yet  
**Fix**: Run the SQL migration above ☝️
