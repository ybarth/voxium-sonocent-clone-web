// AI Conversation — Stateful conversation management for dialogic iteration
// Maintains message history per session for iterative refinement of AI outputs

import type { AIMessage, AICompletionResponse } from './aiProvider';
import { aiRouter } from './aiRouter';
import type { TaskCategory } from './aiProvider';

export interface ConversationSession {
  id: string;
  taskCategory: TaskCategory;
  messages: AIMessage[];
  responses: AICompletionResponse[];
  createdAt: number;
  updatedAt: number;
}

export type IterationMode = 'single' | 'dialogic' | 'auto-iterate';

export interface IterationConfig {
  mode: IterationMode;
  /** For auto-iterate: stop when confidence exceeds this */
  confidenceThreshold: number;
  /** For auto-iterate: max iterations before stopping */
  maxIterations: number;
}

const DEFAULT_CONFIG: IterationConfig = {
  mode: 'single',
  confidenceThreshold: 0.85,
  maxIterations: 5,
};

// ─── Session Manager ─────────────────────────────────────────────────────────

class ConversationManager {
  private sessions = new Map<string, ConversationSession>();
  private config: IterationConfig = { ...DEFAULT_CONFIG };

  /** Create a new conversation session */
  createSession(taskCategory: TaskCategory, systemMessage: string): ConversationSession {
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: ConversationSession = {
      id,
      taskCategory,
      messages: [{ role: 'system', content: systemMessage }],
      responses: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  /** Get an existing session */
  getSession(id: string): ConversationSession | undefined {
    return this.sessions.get(id);
  }

  /** List all active sessions */
  listSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Send a message in an existing conversation and get a response */
  async sendMessage(sessionId: string, userMessage: string): Promise<AICompletionResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.messages.push({ role: 'user', content: userMessage });
    session.updatedAt = Date.now();

    const response = await aiRouter.complete(session.taskCategory, {
      messages: session.messages,
      temperature: 0.7,
      maxTokens: 500,
    });

    session.messages.push({ role: 'assistant', content: response.content });
    session.responses.push(response);

    return response;
  }

  /** Start a new conversation with an initial prompt and get a response */
  async startConversation(
    taskCategory: TaskCategory,
    systemMessage: string,
    initialPrompt: string,
  ): Promise<{ session: ConversationSession; response: AICompletionResponse }> {
    const session = this.createSession(taskCategory, systemMessage);
    const response = await this.sendMessage(session.id, initialPrompt);
    return { session, response };
  }

  /** Iterate: send a refinement message in the conversation */
  async iterate(sessionId: string, refinement: string): Promise<AICompletionResponse> {
    return this.sendMessage(sessionId, refinement);
  }

  /** Auto-iterate: keep refining until confidence threshold or max iterations */
  async autoIterate(
    sessionId: string,
    evaluator: (response: AICompletionResponse) => number,
    onIteration?: (response: AICompletionResponse, iteration: number, confidence: number) => void,
  ): Promise<AICompletionResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    let lastResponse = session.responses[session.responses.length - 1];
    if (!lastResponse) throw new Error('No initial response to iterate on');

    for (let i = 0; i < this.config.maxIterations; i++) {
      const confidence = evaluator(lastResponse);
      onIteration?.(lastResponse, i, confidence);

      if (confidence >= this.config.confidenceThreshold) {
        return lastResponse;
      }

      // Ask the model to improve its own response
      lastResponse = await this.sendMessage(
        sessionId,
        'Please improve your previous response. Make it more complete, accurate, and well-structured. Return only the improved result in the same format.',
      );
    }

    return lastResponse;
  }

  /** Regenerate: resend the last user message for a new response */
  async regenerate(sessionId: string): Promise<AICompletionResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Find last user message
    let lastUserIdx = -1;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) throw new Error('No user message to regenerate');

    // Remove everything after last user message
    session.messages = session.messages.slice(0, lastUserIdx + 1);
    session.updatedAt = Date.now();

    const response = await aiRouter.complete(session.taskCategory, {
      messages: session.messages,
      temperature: 0.8, // Slightly higher for variety
      maxTokens: 500,
    });

    session.messages.push({ role: 'assistant', content: response.content });
    session.responses.push(response);

    return response;
  }

  /** Delete a session */
  deleteSession(id: string): void {
    this.sessions.delete(id);
  }

  /** Clear all sessions */
  clearAll(): void {
    this.sessions.clear();
  }

  /** Get/set iteration config */
  getConfig(): IterationConfig {
    return this.config;
  }

  updateConfig(updates: Partial<IterationConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const conversationManager = new ConversationManager();
