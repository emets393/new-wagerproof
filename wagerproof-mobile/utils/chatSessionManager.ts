import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatThreadService, ChatThread, ChatMessage as ChatThreadMessage } from '../services/chatThreadService';

export interface ChatSession {
  id: string;
  userId: string;
  pageId?: string;
  createdAt: string;
  lastActive: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface BuildShipSessionResponse {
  client_secret?: string;
  clientSecret?: string;
  agent_id?: string;
  agentId?: string;
  sessionResponse?: {
    metadata?: {
      timestamp: number;
      version: string;
    };
    session?: {
      status: string;
      id: string;
      clientSecret: string;
      createdAt: string;
      agentId?: string;
      agent_id?: string;
    };
  };
  sessionId?: string;
  success?: boolean;
  error?: string;
}

const CHAT_SESSIONS_KEY = 'wagerbot_chat_sessions';
const CURRENT_SESSION_KEY = 'wagerbot_current_session';
const BUILDSHIP_ENDPOINT = 'https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf';
const DEFAULT_WORKFLOW_ID = 'wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0';

export class ChatSessionManager {
  private static instance: ChatSessionManager;

  static getInstance(): ChatSessionManager {
    if (!ChatSessionManager.instance) {
      ChatSessionManager.instance = new ChatSessionManager();
    }
    return ChatSessionManager.instance;
  }

  /**
   * Get all chat sessions for a user (from Supabase)
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    try {
      const threads = await chatThreadService.getThreads(userId);
      
      // Convert ChatThread format to ChatSession format
      return threads.map(thread => ({
        id: thread.id,
        userId: thread.user_id,
        createdAt: thread.created_at,
        lastActive: thread.updated_at,
        messages: thread.messages?.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
        })) || [],
      }));
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }

  /**
   * Get current active session (optionally page-specific)
   */
  async getCurrentSession(userId: string, pageId?: string): Promise<ChatSession | null> {
    try {
      // If pageId is provided, look for a page-specific session
      if (pageId) {
        const pageSessionKey = `${CURRENT_SESSION_KEY}_${pageId}`;
        const pageSessionId = await AsyncStorage.getItem(pageSessionKey);

        if (pageSessionId) {
          const thread = await chatThreadService.getThread(pageSessionId);
          if (thread && thread.user_id === userId) {
            console.log(`✅ Found existing session for page: ${pageId}`);
            return {
              id: thread.id,
              userId: thread.user_id,
              pageId: pageId,
              createdAt: thread.created_at,
              lastActive: thread.updated_at,
              messages: thread.messages?.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.created_at,
              })) || [],
            };
          }
        }

        console.log(`❌ No existing session found for page: ${pageId}`);
        return null;
      }

      // Fallback to global session if no pageId provided
      const currentSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      if (!currentSessionId) return null;

      const thread = await chatThreadService.getThread(currentSessionId);
      if (!thread || thread.user_id !== userId) return null;

      return {
        id: thread.id,
        userId: thread.user_id,
        createdAt: thread.created_at,
        lastActive: thread.updated_at,
        messages: thread.messages?.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at,
        })) || [],
      };
    } catch (error) {
      console.error('Error loading current session:', error);
      return null;
    }
  }

  /**
   * Create a new chat session (in Supabase)
   */
  async createNewSession(userId: string, pageId?: string): Promise<ChatSession> {
    // Create thread in Supabase
    const thread = await chatThreadService.createThread(userId);
    
    const newSession: ChatSession = {
      id: thread.id,
      userId: thread.user_id,
      pageId: pageId,
      createdAt: thread.created_at,
      lastActive: thread.updated_at,
      messages: [],
    };

    // Save to AsyncStorage for current session tracking
    await this.setCurrentSession(newSession.id, pageId);

    console.log(`🆕 Created new session: ${thread.id} for page: ${pageId || 'default'}`);

    return newSession;
  }

  /**
   * Get client secret from BuildShip workflow
   * @param userId - User ID
   * @param userEmail - User email
   * @param instructions - Game context to pass to AI as system prompt
   * @param workflowId - BuildShip workflow ID (optional)
   */
  async getClientSecret(
    userId: string,
    userEmail: string,
    instructions?: string,
    workflowId?: string
  ): Promise<{ clientSecret: string; agentId?: string }> {
    try {
      const targetWorkflowId = workflowId || DEFAULT_WORKFLOW_ID;

      console.log('🔑 Calling BuildShip workflow for client secret...', {
        workflowId: targetWorkflowId,
        hasInstructions: !!instructions,
        instructionsLength: instructions?.length || 0,
      });

      if (instructions) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📤 SENDING GAME CONTEXT TO BUILDSHIP');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Instructions length:', instructions.length);
        console.log('Instructions preview:', instructions.substring(0, 300) + '...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('BuildShip request timeout after 15 seconds')), 15000);
      });

      // Call BuildShip workflow with timeout
      const fetchPromise = fetch(BUILDSHIP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          userEmail: userEmail,
          workflowId: targetWorkflowId,
          timestamp: new Date().toISOString(),
          stream: true,
          instructions: instructions, // Pass game context as instructions
        }),
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      console.log('BuildShip response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('BuildShip error response:', errorText);
        throw new Error(`BuildShip workflow failed: ${response.status} ${response.statusText}`);
      }

      const buildShipResult: BuildShipSessionResponse = await response.json();
      console.log('BuildShip result received:', buildShipResult);

      // Handle different response formats for client secret
      let clientSecret: string | undefined;
      let agentId: string | undefined;

      // Format 1: Direct client_secret (snake_case)
      if (buildShipResult.client_secret) {
        clientSecret = buildShipResult.client_secret;
        agentId = buildShipResult.agent_id || buildShipResult.agentId;
      }
      // Format 2: Direct clientSecret (camelCase)
      else if (buildShipResult.clientSecret) {
        clientSecret = buildShipResult.clientSecret;
        agentId = buildShipResult.agentId || buildShipResult.agent_id;
      }
      // Format 3: Nested in sessionResponse.session.clientSecret
      else if (buildShipResult.sessionResponse?.session?.clientSecret) {
        clientSecret = buildShipResult.sessionResponse.session.clientSecret;
        agentId = buildShipResult.sessionResponse.session.agentId || buildShipResult.sessionResponse.session.agent_id;
      }

      if (!clientSecret) {
        console.error('BuildShip result:', JSON.stringify(buildShipResult, null, 2));
        throw new Error('No client secret found in BuildShip workflow response');
      }

      console.log('✅ Client secret extracted successfully:', {
        length: clientSecret.length,
        prefix: clientSecret.substring(0, 15) + '...',
        hasAgentId: !!agentId,
        agentId: agentId,
      });

      return { clientSecret, agentId };
    } catch (error) {
      console.error('❌ Error getting client secret:', error);
      throw error;
    }
  }

  /**
   * Save a session (updates thread activity in Supabase)
   */
  async saveSession(session: ChatSession): Promise<void> {
    try {
      // Update thread activity timestamp in Supabase
      await chatThreadService.updateThreadActivity(session.id);
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  /**
   * Set current active session (page-specific if pageId provided)
   */
  async setCurrentSession(sessionId: string, pageId?: string): Promise<void> {
    try {
      if (pageId) {
        const pageSessionKey = `${CURRENT_SESSION_KEY}_${pageId}`;
        await AsyncStorage.setItem(pageSessionKey, sessionId);
        console.log(`💾 Set current session for page ${pageId}: ${sessionId}`);
      } else {
        await AsyncStorage.setItem(CURRENT_SESSION_KEY, sessionId);
      }
    } catch (error) {
      console.error('Error setting current session:', error);
    }
  }

  /**
   * Delete a session (from Supabase)
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Delete from Supabase
      await chatThreadService.deleteThread(sessionId);

      // Clear current session if it was deleted
      const currentSessionId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      if (currentSessionId === sessionId) {
        await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  /**
   * Clear all sessions for a user (from Supabase)
   */
  async clearUserSessions(userId: string): Promise<void> {
    try {
      const threads = await chatThreadService.getThreads(userId);
      
      // Delete all threads for this user
      await Promise.all(
        threads.map(thread => chatThreadService.deleteThread(thread.id))
      );

      await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error clearing user sessions:', error);
    }
  }

  /**
   * Clear page-specific session (for forcing refresh)
   */
  async clearPageSession(userId: string, pageId: string): Promise<void> {
    try {
      const pageSessionKey = `${CURRENT_SESSION_KEY}_${pageId}`;
      const pageSessionId = await AsyncStorage.getItem(pageSessionKey);

      if (pageSessionId) {
        console.log(`🗑️  Clearing session for page: ${pageId}, sessionId: ${pageSessionId}`);

        // Remove the session from storage
        await this.deleteSession(pageSessionId);

        // Clear the page-specific current session key
        await AsyncStorage.removeItem(pageSessionKey);

        console.log(`✅ Page session cleared successfully for: ${pageId}`);
      } else {
        console.log(`ℹ️  No existing session to clear for page: ${pageId}`);
      }
    } catch (error) {
      console.error('Error clearing page session:', error);
    }
  }
}

export const chatSessionManager = ChatSessionManager.getInstance();

