/**
 * WagerBot - OpenAI Responses API Implementation for BuildShip
 * 
 * Features:
 * - Built-in web search for real-time data
 * - Image analysis support
 * - Streaming responses
 * - Conversation history management
 * 
 * To use this in BuildShip:
 * 1. Create a new REST API endpoint
 * 2. Copy this code into a "Script" node
 * 3. Configure inputs: message, conversationHistory, SystemPrompt
 * 4. Set output to return the stream directly
 */

import OpenAI from "openai";
import { Readable } from "stream";

type NodeInputs = {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  SystemPrompt?: string;
  model?: string;
  enableWebSearch?: boolean;
  enableFileSearch?: boolean;
  vectorStoreIds?: string[];
};

type NodeScriptOptions = {
  auth: any;
  req: any;
  logging: any;
};

export default async function wagerBotResponses(
  {
    message,
    conversationHistory,
    SystemPrompt,
    model = "gpt-5",
    enableWebSearch = true,
    enableFileSearch = false,
    vectorStoreIds = [],
  }: NodeInputs,
  { auth, req, logging }: NodeScriptOptions
) {
  const apiKey = auth.getKey();
  const openai = new OpenAI({ apiKey });

  // Validate input
  if (!message || message.trim().length === 0) {
    logging.log("❌ User message is empty or undefined");
    throw new Error("User message is required");
  }

  logging.log("📨 Processing WagerBot request");
  logging.log(`  - Message length: ${message.length} chars`);
  logging.log(`  - History messages: ${conversationHistory?.length || 0}`);
  logging.log(`  - System prompt: ${SystemPrompt ? `${SystemPrompt.length} chars` : 'none'}`);
  logging.log(`  - Web search: ${enableWebSearch ? 'enabled' : 'disabled'}`);
  logging.log(`  - File search: ${enableFileSearch ? 'enabled' : 'disabled'}`);

  // Build the input messages array
  const messages: any[] = [];

  // 1. Add system prompt
  const basePrompt = `You are WagerBot, an expert sports betting analyst specialized in NFL and College Football. 

You provide:
- Insightful game analysis
- Betting predictions and recommendations
- Real-time injury and weather updates (use web search when needed)
- Statistical breakdowns
- Matchup insights

Be conversational, helpful, and data-driven in your responses.`;

  const systemContent = SystemPrompt 
    ? `${basePrompt}\n\n## GAME DATA CONTEXT\n\n${SystemPrompt}\n\nUse this data to provide insightful analysis and answer questions about specific matchups. Reference specific statistics and predictions when relevant.`
    : basePrompt;

  messages.push({
    role: "system",
    content: systemContent
  });

  // 2. Add conversation history (limit to prevent context overflow)
  if (conversationHistory && Array.isArray(conversationHistory)) {
    // Take last 20 messages (10 exchanges) to stay within context limits
    const recentHistory = conversationHistory.slice(-20);
    messages.push(...recentHistory);
    logging.log(`  - Added ${recentHistory.length} history messages`);
  }

  // 3. Add current user message
  messages.push({
    role: "user",
    content: message
  });

  logging.log(`📊 Total context: ${messages.length} messages`);

  // Build tools array
  const tools: any[] = [];
  
  if (enableWebSearch) {
    tools.push({ type: "web_search" });
    logging.log("🔍 Web search enabled");
  }

  if (enableFileSearch && vectorStoreIds.length > 0) {
    tools.push({ 
      type: "file_search",
      vector_store_ids: vectorStoreIds 
    });
    logging.log(`📁 File search enabled with ${vectorStoreIds.length} vector stores`);
  }

  try {
    // Create streaming response with Responses API
    logging.log("🚀 Calling OpenAI Responses API...");
    
    const stream = await openai.responses.create({
      model: model,
      input: messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
    });

    // Create a readable stream for BuildShip
    const readable = new Readable();
    readable._read = function() {};

    // Handle the streaming response asynchronously
    (async () => {
      try {
        let fullContent = '';
        let chunkCount = 0;
        
        for await (const event of stream) {
          chunkCount++;
          
          // Handle different event types from Responses API
          if (event.type === 'response.output_text.delta') {
            // Text delta - stream it immediately
            const delta = event.delta;
            if (delta) {
              readable.push(delta);
              fullContent += delta;
            }
          }
          else if (event.type === 'response.output_text.done') {
            // Text generation complete
            logging.log(`✅ Text complete: ${fullContent.length} characters, ${chunkCount} chunks`);
          }
          else if (event.type === 'response.function_call_arguments.delta') {
            // Tool (function) is being called - log for debugging
            logging.log('🔧 Tool call in progress...');
          }
          else if (event.type === 'response.function_call_arguments.done') {
            // Tool call complete
            logging.log('✅ Tool call complete');
          }
          else if (event.type === 'response.done') {
            // Entire response complete
            logging.log('🏁 Response stream finished');
            logging.log(`   Final stats: ${fullContent.length} chars, ${chunkCount} events`);
          }
        }

        // End the stream
        readable.push(null);
        logging.log("✅ Stream closed successfully");
        
      } catch (error: any) {
        logging.log(`❌ Stream error: ${error.message}`);
        logging.log(`   Stack: ${error.stack}`);
        
        // Send error message to client
        readable.push(`\n\n[Error: ${error.message}]`);
        readable.push(null);
      }
    })();

    // Return the readable stream
    return readable;
    
  } catch (error: any) {
    logging.log(`❌ Failed to create response: ${error.message}`);
    logging.log(`   Stack: ${error.stack}`);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * BUILDSHIP CONFIGURATION
 * 
 * Input Schema (add these in BuildShip UI):
 * {
 *   "message": {
 *     "type": "string",
 *     "required": true,
 *     "description": "The user's current message"
 *   },
 *   "conversationHistory": {
 *     "type": "array",
 *     "required": false,
 *     "description": "Array of previous messages for context",
 *     "items": {
 *       "type": "object",
 *       "properties": {
 *         "role": { "type": "string", "enum": ["user", "assistant"] },
 *         "content": { "type": "string" }
 *       }
 *     }
 *   },
 *   "SystemPrompt": {
 *     "type": "string",
 *     "required": false,
 *     "description": "Game data and context for analysis"
 *   },
 *   "model": {
 *     "type": "string",
 *     "required": false,
 *     "default": "gpt-5",
 *     "description": "OpenAI model to use"
 *   },
 *   "enableWebSearch": {
 *     "type": "boolean",
 *     "required": false,
 *     "default": true,
 *     "description": "Enable built-in web search"
 *   },
 *   "enableFileSearch": {
 *     "type": "boolean",
 *     "required": false,
 *     "default": false,
 *     "description": "Enable vector store file search"
 *   },
 *   "vectorStoreIds": {
 *     "type": "array",
 *     "required": false,
 *     "items": { "type": "string" },
 *     "description": "Vector store IDs for file search"
 *   }
 * }
 * 
 * Authentication:
 * - Add OpenAI API key to BuildShip secrets
 * - Use auth.getKey() to retrieve it
 * 
 * Output:
 * - Return the stream directly (it will be sent as text/plain)
 * - BuildShip will automatically handle streaming to client
 */

