-- AI Assistant Tables for Desk Mate
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard)
-- 
-- This version is compatible with your existing database:
-- - Uses profiles(id) for user references
-- - Uses existing transcriptions table (recording_id -> meeting_recordings -> meetings)
-- - Uses existing meeting_summaries table (meeting_id -> meetings)
-- - RLS policies use relationship-based checks

-- ============================================
-- 1. AI Settings - User preferences for AI context
-- ============================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  context_calendar BOOLEAN DEFAULT true,
  context_journal BOOLEAN DEFAULT true,
  context_meetings BOOLEAN DEFAULT true,
  context_analytics BOOLEAN DEFAULT true,
  preferred_language TEXT DEFAULT 'en',
  summary_style TEXT DEFAULT 'concise' CHECK (summary_style IN ('concise', 'detailed', 'bullet_points')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);

-- ============================================
-- 2. AI Conversations - Chat threads
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  context_sources JSONB DEFAULT '{"calendar": true, "journal": true, "meetings": true, "analytics": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(updated_at DESC);

-- ============================================
-- 3. AI Messages - Individual chat messages
-- ============================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context_used JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on AI tables
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AI Settings policies (has user_id column)
-- ============================================
DROP POLICY IF EXISTS "Users can view own AI settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can insert own AI settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can update own AI settings" ON ai_settings;

CREATE POLICY "Users can view own AI settings" ON ai_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI settings" ON ai_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AI settings" ON ai_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- AI Conversations policies (has user_id column)
-- ============================================
DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON ai_conversations;

CREATE POLICY "Users can view own conversations" ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON ai_conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- AI Messages policies (through conversation ownership)
-- ============================================
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON ai_messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON ai_messages;

CREATE POLICY "Users can view messages in own conversations" ON ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_conversations 
      WHERE ai_conversations.id = ai_messages.conversation_id 
      AND ai_conversations.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert messages in own conversations" ON ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations 
      WHERE ai_conversations.id = ai_messages.conversation_id 
      AND ai_conversations.user_id = auth.uid()
    )
  );

-- ============================================
-- EXISTING TABLES: Add RLS if not already enabled
-- ============================================

-- Enable RLS on existing meeting_summaries table
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;

-- meeting_summaries RLS: Check ownership through meetings.host_user_id
-- Path: meeting_summaries.meeting_id -> meetings.host_user_id
DROP POLICY IF EXISTS "Users can view own meeting summaries" ON meeting_summaries;
DROP POLICY IF EXISTS "Users can insert own meeting summaries" ON meeting_summaries;
DROP POLICY IF EXISTS "Users can update own meeting summaries" ON meeting_summaries;
DROP POLICY IF EXISTS "Users can delete own meeting summaries" ON meeting_summaries;

CREATE POLICY "Users can view own meeting summaries" ON meeting_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_summaries.meeting_id 
      AND meetings.host_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own meeting summaries" ON meeting_summaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_summaries.meeting_id 
      AND meetings.host_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own meeting summaries" ON meeting_summaries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_summaries.meeting_id 
      AND meetings.host_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own meeting summaries" ON meeting_summaries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_summaries.meeting_id 
      AND meetings.host_user_id = auth.uid()
    )
  );

-- Enable RLS on existing transcriptions table
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- transcriptions RLS: Check ownership through meeting_recordings -> meetings -> host_user_id
-- Path: transcriptions.recording_id -> meeting_recordings.meeting_id -> meetings.host_user_id
DROP POLICY IF EXISTS "Users can view own transcriptions" ON transcriptions;
DROP POLICY IF EXISTS "Users can insert own transcriptions" ON transcriptions;
DROP POLICY IF EXISTS "Users can update own transcriptions" ON transcriptions;
DROP POLICY IF EXISTS "Users can delete own transcriptions" ON transcriptions;

CREATE POLICY "Users can view own transcriptions" ON transcriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meeting_recordings 
      JOIN meetings ON meetings.id = meeting_recordings.meeting_id
      WHERE meeting_recordings.id = transcriptions.recording_id 
      AND meetings.host_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own transcriptions" ON transcriptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM meeting_recordings 
      JOIN meetings ON meetings.id = meeting_recordings.meeting_id
      WHERE meeting_recordings.id = transcriptions.recording_id 
      AND meetings.host_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own transcriptions" ON transcriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meeting_recordings 
      JOIN meetings ON meetings.id = meeting_recordings.meeting_id
      WHERE meeting_recordings.id = transcriptions.recording_id 
      AND meetings.host_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own transcriptions" ON transcriptions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM meeting_recordings 
      JOIN meetings ON meetings.id = meeting_recordings.meeting_id
      WHERE meeting_recordings.id = transcriptions.recording_id 
      AND meetings.host_user_id = auth.uid()
    )
  );

-- ============================================
-- SUCCESS
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ AI tables created successfully!';
  RAISE NOTICE 'New tables: ai_settings, ai_conversations, ai_messages';
  RAISE NOTICE 'RLS policies configured for: ai_settings, ai_conversations, ai_messages, meeting_summaries, transcriptions';
END $$;
