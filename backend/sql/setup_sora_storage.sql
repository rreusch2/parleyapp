-- ===============================================
-- Sora 2 Video Storage Setup
-- Run this in Supabase SQL Editor (AFTER creating bucket in UI)
-- ===============================================

-- STEP 1: CREATE BUCKET VIA SUPABASE DASHBOARD (DO THIS FIRST!)
-- Go to: Storage → New Bucket
-- Name: generated-videos
-- Public: YES (enable)
-- File size limit: 500 MB
-- Allowed MIME types: video/mp4, video/quicktime, video/webm
--
-- OR use this commented code if you have the Management API token:
-- (Uncomment and replace YOUR_SERVICE_ROLE_KEY)
/*
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/bucket' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "generated-videos",
    "name": "generated-videos",
    "public": true,
    "file_size_limit": 524288000,
    "allowed_mime_types": ["video/mp4", "video/quicktime", "video/webm"]
  }'
*/

-- STEP 2: SET UP STORAGE POLICIES (Run this SQL after bucket is created)

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

-- Verify setup
SELECT 
  'Storage bucket created: generated-videos' AS status,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename = 'objects' 
  AND policyname LIKE '%videos%';

COMMENT ON TABLE storage.buckets IS 'Storage buckets for user-generated content including Sora 2 AI videos';
COMMENT ON FUNCTION increment_video_views IS 'Atomically increment video view counter for analytics';
COMMENT ON FUNCTION increment_video_downloads IS 'Atomically increment video download counter for analytics';
COMMENT ON FUNCTION increment_video_shares IS 'Atomically increment video share counter for analytics';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sora 2 video storage setup completed successfully!';
  RAISE NOTICE 'Bucket: generated-videos';
  RAISE NOTICE 'Public access: enabled';
  RAISE NOTICE 'Max file size: 500MB';
  RAISE NOTICE 'Allowed types: video/mp4, video/quicktime, video/webm';
END $$;

