import { get, post } from "../../lib/api";
import type { ChatConversation, ChatMessage, Page } from "../../types";

export const CONVERSATIONS_KEY = ["chat", "conversations"] as const;
export const CHAT_UNREAD_KEY = ["chat", "unread"] as const;
export const messagesKey = (id: number) => ["chat", "messages", id] as const;

export interface MessageList {
  results: ChatMessage[]; // ascending
  olderPage: number | null;
}

/** id for a not-yet-persisted (draft) conversation opened from the
 * employee directory. Materialized lazily on the first real activity. */
export const DRAFT_CONVERSATION_ID = 0;

export async function ensureConversation(
  peerId: number,
): Promise<ChatConversation> {
  return post<ChatConversation>("/api/chat/conversations/", {
    user_id: peerId,
  });
}

/** Fetch a messages page (server returns desc → we keep asc). */
export async function fetchMessages(
  convId: number,
  page: number,
): Promise<MessageList> {
  const p = await get<Page<ChatMessage>>(
    `/api/chat/conversations/${convId}/messages/?page=${page}&page_size=40`,
  );
  return {
    results: [...p.results].reverse(),
    olderPage: p.next ? page + 1 : null,
  };
}
