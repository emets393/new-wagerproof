import { supabase } from './supabase';

export interface ChatThread {
  id: string;
  user_id: string;
  title: string | null;
  openai_thread_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

class ChatThreadService {
  /**
   * Create a new chat thread
   */
  async createThread(
    userId: string,
    firstMessage?: string,
    openaiThreadId?: string
  ): Promise<ChatThread> {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          title: firstMessage ? firstMessage.substring(0, 50) + '...' : null,
          openai_thread_id: openaiThreadId || null,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Created thread:', data.id);
      return data as ChatThread;
    } catch (error) {
      console.error('❌ Error creating thread:', error);
      throw error;
    }
  }

  /**
   * Update thread title (typically AI-generated)
   */
  async updateThreadTitle(threadId: string, title: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ title })
        .eq('id', threadId);

      if (error) throw error;

      console.log('✅ Updated thread title:', threadId);
    } catch (error) {
      console.error('❌ Error updating thread title:', error);
      throw error;
    }
  }

  /**
   * Update OpenAI thread ID
   */
  async updateOpenAIThreadId(threadId: string, openaiThreadId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ openai_thread_id: openaiThreadId })
        .eq('id', threadId);

      if (error) throw error;

      console.log('✅ Updated OpenAI thread ID:', threadId);
    } catch (error) {
      console.error('❌ Error updating OpenAI thread ID:', error);
      throw error;
    }
  }

  /**
   * Save a message to a thread
   */
  async saveMessage(
    threadId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<ChatMessage> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Saved message to thread:', threadId);
      return data as ChatMessage;
    } catch (error) {
      console.error('❌ Error saving message:', error);
      throw error;
    }
  }

  /**
   * Get all threads for a user (sorted by most recent)
   */
  async getThreads(userId: string): Promise<ChatThread[]> {
    try {
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      console.log('✅ Loaded', data?.length || 0, 'threads for user');
      return (data as ChatThread[]) || [];
    } catch (error) {
      console.error('❌ Error loading threads:', error);
      return [];
    }
  }

  /**
   * Get a specific thread with all its messages
   */
  async getThread(threadId: string): Promise<ChatThread | null> {
    try {
      // Get thread
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('id', threadId)
        .single();

      if (threadError) throw threadError;

      // Get messages for thread
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      const thread = threadData as ChatThread;
      thread.messages = (messagesData as ChatMessage[]) || [];

      console.log('✅ Loaded thread with', thread.messages.length, 'messages');
      return thread;
    } catch (error) {
      console.error('❌ Error loading thread:', error);
      return null;
    }
  }

  /**
   * Update thread activity timestamp
   */
  async updateThreadActivity(threadId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      if (error) throw error;
    } catch (error) {
      console.error('❌ Error updating thread activity:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Delete a thread and all its messages
   */
  async deleteThread(threadId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId);

      if (error) throw error;

      console.log('✅ Deleted thread:', threadId);
    } catch (error) {
      console.error('❌ Error deleting thread:', error);
      throw error;
    }
  }

  /**
   * Generate AI title for thread (after first exchange)
   */
  async generateThreadTitle(
    threadId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      console.log('🤖 Generating AI title for thread:', threadId);

      // Use OpenAI to generate a concise title
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Generate a concise 3-5 word title that summarizes the following conversation. Return only the title, no quotes or explanation.',
            },
            {
              role: 'user',
              content: `User: ${userMessage}\n\nAssistant: ${assistantMessage.substring(0, 200)}`,
            },
          ],
          max_tokens: 20,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      const title = result.choices[0]?.message?.content?.trim() || 'Chat Conversation';

      // Update thread title in Supabase
      await this.updateThreadTitle(threadId, title);

      console.log('✅ Generated title:', title);
    } catch (error) {
      console.error('❌ Error generating title:', error);
      // Non-critical, don't throw - leave default title
    }
  }
}

export const chatThreadService = new ChatThreadService();

