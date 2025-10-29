-- Create chat_threads table
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  openai_thread_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at ON chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(thread_id, created_at);

-- Enable Row Level Security
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_threads
CREATE POLICY "Users can view their own threads"
  ON chat_threads FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own threads"
  ON chat_threads FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own threads"
  ON chat_threads FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own threads"
  ON chat_threads FOR DELETE
  USING (auth.uid()::text = user_id);

-- Create policies for chat_messages
CREATE POLICY "Users can view messages from their threads"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert messages to their threads"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.user_id = auth.uid()::text
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_threads
  SET updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update thread timestamp when message is added
CREATE TRIGGER update_thread_timestamp_on_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_thread_timestamp();

-- Create function to update message_count
CREATE OR REPLACE FUNCTION update_message_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE chat_threads
    SET message_count = message_count + 1
    WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE chat_threads
    SET message_count = message_count - 1
    WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update message_count
CREATE TRIGGER update_message_count_on_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_count();

CREATE TRIGGER update_message_count_on_delete
  AFTER DELETE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_count();

