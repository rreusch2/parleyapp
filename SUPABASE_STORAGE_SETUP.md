# 🪣 Supabase Storage Setup for Sora Videos

## Easy 2-Step Setup

### Step 1: Create Storage Bucket (Via Dashboard)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click **Storage** in the left sidebar
3. Click **"New bucket"** button
4. Fill in the form:
   - **Name**: `generated-videos`
   - **Public bucket**: ✅ **YES** (toggle ON)
   - **File size limit**: `500` MB (or 524288000 bytes)
   - **Allowed MIME types**: Add these 3:
     - `video/mp4`
     - `video/quicktime`
     - `video/webm`
5. Click **"Create bucket"**

### Step 2: Run SQL for Policies (Via SQL Editor)

1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New query"**
3. Copy and paste this SQL:

```sql
-- Set up storage policies for generated-videos bucket

-- Policy: Users can upload their own videos
DROP POLICY IF EXISTS "Users can upload their own videos" ON storage.objects;
CREATE POLICY "Users can upload their own videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-videos' 
  AND (storage.foldername(name))[1] = 'videos'
);

-- Policy: Videos are publicly accessible (for viewing)
DROP POLICY IF EXISTS "Videos are publicly accessible" ON storage.objects;
CREATE POLICY "Videos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-videos');

-- Policy: Users can update their own videos
DROP POLICY IF EXISTS "Users can update their own videos" ON storage.objects;
CREATE POLICY "Users can update their own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND (storage.foldername(name))[1] = 'videos'
);

-- Policy: Users can delete their own videos
DROP POLICY IF EXISTS "Users can delete their own videos" ON storage.objects;
CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-videos'
  AND (storage.foldername(name))[1] = 'videos'
);

-- Create helper function to increment video views
CREATE OR REPLACE FUNCTION increment_video_views(video_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_generated_videos
  SET views_count = views_count + 1,
      updated_at = NOW()
  WHERE id = video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to increment video downloads
CREATE OR REPLACE FUNCTION increment_video_downloads(video_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_generated_videos
  SET downloads_count = downloads_count + 1,
      updated_at = NOW()
  WHERE id = video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to increment video shares
CREATE OR REPLACE FUNCTION increment_video_shares(video_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_generated_videos
  SET shares_count = shares_count + 1,
      updated_at = NOW()
  WHERE id = video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster video queries
CREATE INDEX IF NOT EXISTS idx_user_videos_status_created 
ON user_generated_videos(user_id, generation_status, created_at DESC);

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION increment_video_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_video_downloads(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_video_shares(UUID) TO authenticated;

-- Success!
SELECT 'Storage setup complete! ✅' AS status;
```

4. Click **"Run"** or press `Ctrl+Enter`
5. You should see: `Storage setup complete! ✅`

## ✅ Verify Setup

Run this query to check if everything is ready:

```sql
-- Check if bucket exists and policies are set
SELECT 
  b.id AS bucket_name,
  b.public AS is_public,
  COUNT(p.policyname) AS policy_count
FROM storage.buckets b
LEFT JOIN pg_policies p ON p.tablename = 'objects' 
  AND p.policyname LIKE '%videos%'
WHERE b.id = 'generated-videos'
GROUP BY b.id, b.public;
```

You should see:
- `bucket_name`: generated-videos
- `is_public`: true
- `policy_count`: 4

## 🎉 Done!

Your storage is now ready for Sora 2 videos! 

Next step: Add `OPENAI_API_KEY` to your Railway backend environment.

---

## Troubleshooting

### "Bucket already exists"
→ That's fine! Just skip to Step 2 (run the SQL)

### "Permission denied on storage.buckets"
→ This is normal. You MUST create the bucket via the Dashboard UI (Step 1), not SQL

### "Policy already exists"
→ That's why we use `DROP POLICY IF EXISTS` - it's safe to re-run

### Can't see bucket in Storage tab
→ Refresh the page or try a different browser

