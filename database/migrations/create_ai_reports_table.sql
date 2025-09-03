-- Migration: Create AI Reports Table for Daily AI Report Feature
-- Created: 2025-01-20
-- Purpose: Store AI-generated daily sports reports with metadata

CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL DEFAULT 'daily',
  content TEXT NOT NULL,
  metadata JSONB,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_ai_reports_type_generated ON ai_reports(report_type, generated_at DESC);

-- Add RLS policies
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read reports
CREATE POLICY "Allow authenticated users to read ai_reports" ON ai_reports
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow service role to insert/update reports
CREATE POLICY "Allow service role to manage ai_reports" ON ai_reports
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON ai_reports TO authenticated;
GRANT ALL ON ai_reports TO service_role;
