import { User } from '@supabase/supabase-js';

export interface ChatSession {
  id: string;
  userId: string;
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

export class ChatSessionManager {
  private static instance: ChatSessionManager;
  
  static getInstance(): ChatSessionManager {
    if (!ChatSessionManager.instance) {
      ChatSessionManager.instance = new ChatSessionManager();
    }
    return ChatSessionManager.instance;
  }

  // Get all chat sessions for a user
  getUserSessions(userId: string): ChatSession[] {
    try {
      const sessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessions) return [];
      
      const allSessions: ChatSession[] = JSON.parse(sessions);
      return allSessions.filter(session => session.userId === userId);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }

  // Get current active session
  getCurrentSession(userId: string): ChatSession | null {
    try {
      const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY);
      if (!currentSessionId) return null;
      
      const sessions = this.getUserSessions(userId);
      return sessions.find(session => session.id === currentSessionId) || null;
    } catch (error) {
      console.error('Error loading current session:', error);
      return null;
    }
  }

  // Create a new chat session using BuildShip workflow
  async createNewSession(user: User): Promise<ChatSession> {
    // Create local session object first
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession: ChatSession = {
      id: sessionId,
      userId: user.id,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      messages: [],
    };

    // Save to localStorage
    this.saveSession(newSession);
    this.setCurrentSession(newSession.id);

    return newSession;
  }

  // Get client secret and agent ID for ChatKit - calls BuildShip workflow
  async getClientSecret(user: User, existingSecret?: string): Promise<{ clientSecret: string; agentId?: string }> {
    try {
      // If we have an existing secret, we could refresh it here
      if (existingSecret) {
        console.log('Existing client secret provided, attempting refresh...');
      }

      console.log('Calling BuildShip workflow for client secret...');

      // Call BuildShip workflow to generate client secret
      const response = await fetch('https://xna68l.buildship.run/chatKitSessionGenerator-2fc1c5152ebf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          workflowId: 'wf_68ed847d7a44819095f0e8eca93bfd660fc4b093b131f0f0',
          // version: '1', // Omitted to use production agent
          timestamp: new Date().toISOString(),
        }),
      });

      console.log('BuildShip response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('BuildShip error response:', errorText);
        throw new Error(`BuildShip workflow failed: ${response.statusText}`);
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

      console.log('Client secret extracted successfully:', { 
        length: clientSecret.length,
        prefix: clientSecret.substring(0, 15) + '...',
        hasAgentId: !!agentId,
        agentId: agentId
      });

      return { clientSecret, agentId };
    } catch (error) {
      console.error('Error getting client secret:', error);
      throw error;
    }
  }

  // Save a session to localStorage
  saveSession(session: ChatSession): void {
    try {
      const sessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      const allSessions: ChatSession[] = sessions ? JSON.parse(sessions) : [];
      
      // Update existing session or add new one
      const existingIndex = allSessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        allSessions[existingIndex] = { ...session, lastActive: new Date().toISOString() };
      } else {
        allSessions.push(session);
      }

      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(allSessions));
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  // Set current active session
  setCurrentSession(sessionId: string): void {
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
  }

  // Add message to session
  addMessageToSession(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    try {
      const sessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessions) return;

      const allSessions: ChatSession[] = JSON.parse(sessions);
      const sessionIndex = allSessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex >= 0) {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
        };

        allSessions[sessionIndex].messages.push(newMessage);
        allSessions[sessionIndex].lastActive = new Date().toISOString();
        
        localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(allSessions));
      }
    } catch (error) {
      console.error('Error adding message to session:', error);
    }
  }

  // Delete a session
  deleteSession(sessionId: string): void {
    try {
      const sessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessions) return;

      const allSessions: ChatSession[] = JSON.parse(sessions);
      const filteredSessions = allSessions.filter(s => s.id !== sessionId);
      
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(filteredSessions));

      // Clear current session if it was deleted
      const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY);
      if (currentSessionId === sessionId) {
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  // Clear all sessions for a user
  clearUserSessions(userId: string): void {
    try {
      const sessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessions) return;

      const allSessions: ChatSession[] = JSON.parse(sessions);
      const otherUserSessions = allSessions.filter(s => s.userId !== userId);
      
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(otherUserSessions));
      localStorage.removeItem(CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error clearing user sessions:', error);
    }
  }
}

export const chatSessionManager = ChatSessionManager.getInstance();
