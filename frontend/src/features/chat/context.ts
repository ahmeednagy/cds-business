import { createContext, useContext } from "react";

import type { CallMode } from "../../lib/rtc";
import type { ChatConversation, ChatUser } from "../../types";

export type CallStatus = "outgoing" | "incoming" | "connecting" | "active";

export interface CallState {
  callId: string;
  peer: ChatUser;
  mode: CallMode;
  status: CallStatus;
  startedAt?: number;
  muted: boolean;
  cameraOff: boolean;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  error?: string | null;
  /** Inbound offer carried on the invite (callee only). */
  sdp?: RTCSessionDescriptionInit;
}

export interface ChatContextValue {
  openConversation: ChatConversation | null;
  openChat: (c: ChatConversation) => void;
  closeChat: () => void;
  minimized: boolean;
  setMinimized: (v: boolean) => void;
  online: ReadonlySet<number>;
  noteOnline: (ids: number[]) => void;
  connected: boolean;
  call: CallState | null;
  startCall: (peer: ChatUser, mode: CallMode) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
