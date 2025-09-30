# Vercel Environment Variables Check

## 🚨 Professor Lock Needs This Environment Variable

The Professor Lock session creation is failing because `SUPABASE_SERVICE_ROLE_KEY` is likely missing from Vercel.

### Check Your Vercel Environment Variables:

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Make sure you have **ALL** of these:

```
NEXT_PUBLIC_SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  ⚠️ THIS ONE IS CRITICAL
```

### How to Get Your Service Role Key:

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/iriaegoipkjtktitpary
2. Click **Settings** (gear icon) → **API**
3. Scroll to **Project API keys**
4. Copy the **`service_role`** key (NOT the anon key)
5. Add it to Vercel as `SUPABASE_SERVICE_ROLE_KEY`

### After Adding:

1. **Redeploy** your Vercel project (or wait for next auto-deploy)
2. Test `/professor-lock` again
3. Click "Start Session" - should work now!

---

**Current Error**: `Failed to create session` (500)  
**Likely Cause**: Missing `SUPABASE_SERVICE_ROLE_KEY` in Vercel  
**Fix**: Add the environment variable and redeploy
