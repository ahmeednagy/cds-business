import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { chatSocket, type ChatEvent } from "../../lib/chatSocket";
import { RtcSession, type CallMode } from "../../lib/rtc";
import type { ChatConversation, ChatMessage, ChatUser, Page } from "../../types";
import {
  CHAT_UNREAD_KEY,
  CONVERSATIONS_KEY,
  messagesKey,
  type MessageList,
} from "./api";
import {
  ChatContext,
  type CallState,
  type ChatContextValue,
} from "./context";

const newCallId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openConversation, setOpenConversation] =
    useState<ChatConversation | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [connected, setConnected] = useState(false);
  const [call, setCall] = useState<CallState | null>(null);

  const rtcRef = useRef<RtcSession | null>(null);
  const openRef = useRef<ChatConversation | null>(null);
  const callRef = useRef<CallState | null>(null);
  const ringTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    openRef.current = openConversation;
  }, [openConversation]);
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const myId = user?.id ?? 0;

  const noteOnline = useCallback((ids: number[]) => {
    setOnline((prev) => new Set([...prev, ...ids]));
  }, []);

  const markRead = useCallback(
    (convId: number) => {
      queryClient.setQueryData<Page<ChatConversation>>(
        CONVERSATIONS_KEY,
        (old) =>
          old
            ? {
                ...old,
                results: old.results.map((c) =>
                  c.id === convId ? { ...c, unread_count: 0 } : c,
                ),
              }
            : old,
      );
      void post(`/api/chat/conversations/${convId}/read/`).then(() => {
        queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      });
    },
    [queryClient],
  );

  const openChat = useCallback(
    (c: ChatConversation) => {
      setOpenConversation(c);
      setMinimized(false);
      if (c.unread_count > 0) markRead(c.id);
    },
    [markRead],
  );

  const closeChat = useCallback(() => setOpenConversation(null), []);

  // ---------- calls ----------
  const teardown = useCallback(() => {
    rtcRef.current?.close();
    rtcRef.current = null;
    if (ringTimeout.current) clearTimeout(ringTimeout.current);
    ringTimeout.current = null;
  }, []);

  const signalTo = useCallback((to: number, payload: Record<string, unknown>) => {
    chatSocket.send({ ...payload, to });
  }, []);

  const hangUp = useCallback(
    (notify = true) => {
      const c = callRef.current;
      if (c && notify)
        signalTo(c.peer.id, {
          type: "call.end",
          callId: c.callId,
          // Let the backend map a broken call to "failed" instead of
          // "completed"/"cancelled" when we hang up on an error.
          ...(c.error ? { reason: c.error } : {}),
        });
      teardown();
      setCall(null);
    },
    [signalTo, teardown],
  );

  const wireSession = useCallback(
    (session: RtcSession, peerId: number, callId: string) => {
      session.onIce = (c) =>
        signalTo(peerId, { type: "call.signal", callId, candidate: c });
      session.onRemoteStream = (s) =>
        setCall((cur) =>
          cur ? { ...cur, remoteStream: s, status: "active" } : cur,
        );
      session.onStateChange = (s) => {
        if (s === "failed" || s === "disconnected" || s === "closed")
          setCall((cur) =>
            cur && cur.callId === callId ? { ...cur, error: "connection" } : cur,
          );
      };
    },
    [signalTo],
  );

  const failSoon = useCallback(
    (error: string) => {
      setCall((cur) => (cur ? { ...cur, error } : cur));
      ringTimeout.current = setTimeout(() => hangUp(false), 1600);
    },
    [hangUp],
  );

  const startCall = useCallback(
    (peer: ChatUser, mode: CallMode) => {
      if (callRef.current) return;
      const callId = newCallId();
      setCall({
        callId,
        peer,
        mode,
        status: "outgoing",
        muted: false,
        cameraOff: false,
        remoteStream: null,
        localStream: null,
      });
      void (async () => {
        try {
          const session = await RtcSession.create(mode);
          rtcRef.current = session;
          wireSession(session, peer.id, callId);
          const offer = await session.offer();
          setCall((cur) =>
            cur ? { ...cur, localStream: session.local } : cur,
          );
          signalTo(peer.id, {
            type: "call.invite",
            callId,
            mode,
            sdp: offer,
            caller: {
              id: myId,
              email: user?.email,
              first_name: user?.profile?.first_name,
              last_name: user?.profile?.last_name,
              job_title: user?.profile?.job_title,
            },
          });
          // The backend ring watchdog is authoritative: at ~30s it marks
          // the call MISSED and pushes call.end{reason:"timeout"} to both
          // sides. This local timer only mirrors that in the UI and is a
          // failsafe that ends the call if the server signal never lands.
          ringTimeout.current = setTimeout(() => {
            setCall((cur) =>
              cur && cur.callId === callId && cur.status === "outgoing"
                ? { ...cur, error: "noanswer" }
                : cur,
            );
            ringTimeout.current = setTimeout(() => {
              if (
                callRef.current?.callId === callId &&
                callRef.current.status === "outgoing"
              )
                hangUp(true);
            }, 10_000);
          }, 30_000);
        } catch {
          // Never signalled (e.g. mic/camera denied) — still persist the
          // failed attempt so history shows it.
          void post(`/api/chat/calls/failed/`, {
            user_id: peer.id,
            mode,
          }).catch(() => {});
          failSoon("media");
        }
      })();
    },
    [myId, user, signalTo, hangUp, wireSession, failSoon],
  );

  const acceptCall = useCallback(() => {
    const c = callRef.current;
    if (!c || c.status !== "incoming" || !c.sdp) return;
    void (async () => {
      try {
        const session = await RtcSession.create(c.mode);
        rtcRef.current = session;
        wireSession(session, c.peer.id, c.callId);
        const answer = await session.acceptOffer(c.sdp!);
        setCall((cur) =>
          cur
            ? {
                ...cur,
                status: "connecting",
                localStream: session.local,
                startedAt: Date.now(),
                sdp: undefined,
              }
            : cur,
        );
        signalTo(c.peer.id, {
          type: "call.accept",
          callId: c.callId,
          sdp: answer,
        });
      } catch {
        signalTo(c.peer.id, {
          type: "call.decline",
          callId: c.callId,
          reason: "media",
        });
        failSoon("media");
      }
    })();
  }, [signalTo, wireSession, failSoon]);

  const declineCall = useCallback(() => {
    const c = callRef.current;
    if (c) signalTo(c.peer.id, { type: "call.decline", callId: c.callId });
    teardown();
    setCall(null);
  }, [signalTo, teardown]);

  const toggleMic = useCallback(() => {
    const next = !(callRef.current?.muted ?? false);
    rtcRef.current?.setMic(!next);
    setCall((cur) => (cur ? { ...cur, muted: next } : cur));
  }, []);

  const toggleCamera = useCallback(() => {
    const next = !(callRef.current?.cameraOff ?? false);
    rtcRef.current?.setCamera(!next);
    setCall((cur) => (cur ? { ...cur, cameraOff: next } : cur));
  }, []);

  // ---------- WS lifecycle + events ----------
  useEffect(() => {
    if (!user) return;
    chatSocket.start();
    const ping = setInterval(() => setConnected(chatSocket.connected), 2000);
    const unsub = chatSocket.subscribe((ev: ChatEvent) => {
      if (ev.type === "presence") {
        setOnline((prev) => {
          const next = new Set(prev);
          if (ev.online) next.add(ev.user_id as number);
          else next.delete(ev.user_id as number);
          return next;
        });
        return;
      }

      if (ev.type === "chat.message") {
        const msg = ev.message as ChatMessage;
        const convId = ev.conversation_id as number;
        const mine = msg.sender === myId;
        const viewingThis =
          openRef.current?.id === convId && !document.hidden;

        // Conversation list: bump last message + unread for others' messages.
        queryClient.setQueryData<Page<ChatConversation>>(
          CONVERSATIONS_KEY,
          (old) => {
            if (!old) return old;
            const found = old.results.find((c) => c.id === convId);
            if (!found) {
              // First-ever event for this conversation — refetch so the
              // new conversation (and its missed call) appears.
              queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
            }
            const results = found
              ? old.results.map((c) =>
                  c.id === convId
                    ? {
                        ...c,
                        last_message: msg,
                        last_message_at: msg.created_at,
                        unread_count:
                          mine || viewingThis ? 0 : c.unread_count + 1,
                      }
                    : c,
                )
              : old.results;
            return {
              ...old,
              results: [...results].sort((a, b) =>
                (b.last_message_at ?? "").localeCompare(
                  a.last_message_at ?? "",
                ),
              ),
            };
          },
        );
        queryClient.setQueryData<MessageList>(messagesKey(convId), (old) =>
          old && !old.results.some((m) => m.id === msg.id)
            ? { ...old, results: [...old.results, msg] }
            : old,
        );
        if (!mine) {
          if (viewingThis) markRead(convId);
          else queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_KEY });
        }
        return;
      }

      // ---- call signalling ----
      if (!ev.type?.startsWith("call.")) return;
      const from = ev.from as number;
      const callId = ev.callId as string;
      const cur = callRef.current;

      if (ev.type === "call.invite") {
        if (cur) {
          signalTo(from, { type: "call.decline", callId, reason: "busy" });
          return;
        }
        setCall({
          callId,
          peer: ev.caller as ChatUser,
          mode: ev.mode as CallMode,
          status: "incoming",
          muted: false,
          cameraOff: false,
          remoteStream: null,
          localStream: null,
          sdp: ev.sdp as RTCSessionDescriptionInit,
        });
        return;
      }
      if (!cur || cur.callId !== callId) return;
      // The server ring watchdog ends calls with from=<caller id>, which on
      // the caller's own client is self, not the peer — allow that shape.
      if (from !== cur.peer.id && !(ev.type === "call.end" && from === myId))
        return;

      if (ev.type === "call.accept") {
        void rtcRef.current?.acceptAnswer(ev.sdp as RTCSessionDescriptionInit);
        setCall({ ...cur, status: "connecting", startedAt: Date.now() });
        if (ringTimeout.current) clearTimeout(ringTimeout.current);
      } else if (ev.type === "call.decline") {
        setCall({ ...cur, error: (ev.reason as string) || "declined" });
        setTimeout(() => hangUp(false), 1500);
      } else if (ev.type === "call.end") {
        if (cur.status === "outgoing" && ev.reason === "timeout") {
          // Server watchdog fired: show "No answer" briefly, then close.
          setCall({ ...cur, error: "noanswer" });
          setTimeout(() => hangUp(false), 1500);
        } else {
          hangUp(false);
        }
      } else if (ev.type === "call.signal" && ev.candidate) {
        void rtcRef.current?.addIce(ev.candidate as RTCIceCandidateInit);
      }
    });
    return () => {
      clearInterval(ping);
      unsub();
      chatSocket.stop();
    };
  }, [user, myId, queryClient, markRead, signalTo, hangUp]);

  const value = useMemo<ChatContextValue>(
    () => ({
      openConversation,
      openChat,
      closeChat,
      minimized,
      setMinimized,
      online,
      noteOnline,
      connected,
      call,
      startCall,
      acceptCall,
      declineCall,
      endCall: () => hangUp(true),
      toggleMic,
      toggleCamera,
    }),
    [
      openConversation,
      openChat,
      closeChat,
      minimized,
      online,
      noteOnline,
      connected,
      call,
      startCall,
      acceptCall,
      declineCall,
      hangUp,
      toggleMic,
      toggleCamera,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
