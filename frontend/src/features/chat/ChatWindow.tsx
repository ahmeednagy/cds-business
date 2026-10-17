import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  alpha,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  Paper,
  Popover,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CloseIcon from "@mui/icons-material/Close";
import RemoveIcon from "@mui/icons-material/Remove";
import SendIcon from "@mui/icons-material/Send";
import InsertEmoticonOutlinedIcon from "@mui/icons-material/InsertEmoticonOutlined";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

import { get, post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ChatAvatar } from "../../components/ChatAvatar";
import { displayName } from "../../lib/chatFormat";
import { ErrorAlert } from "../../components/ui";
import type { ChatConversation, ChatMessage } from "../../types";
import {
  CONVERSATIONS_KEY,
  DRAFT_CONVERSATION_ID,
  ensureConversation,
  fetchMessages,
  messagesKey,
  type MessageList,
} from "./api";
import { CallEventMessage } from "./CallEvent";
import { useChat } from "./context";

const EMOJIS = [
  "👍", "😊", "😂", "❤️", "🎉", "🙏", "👏", "🔥",
  "😍", "🤔", "👌", "💯", "✅", "🚀", "☕", "😅",
  "🤝", "💪", "🙌", "⭐", "📌", "⏰", "📅", "✨",
];

function Bubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  const { i18n } = useTranslation();
  const time = new Date(msg.created_at).toLocaleTimeString(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: mine ? "flex-end" : "flex-start",
        mb: 1,
      }}
    >
      <Box
        sx={(theme) => ({
          maxWidth: "82%",
          px: 1.5,
          py: 1,
          borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          bgcolor: mine
            ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.28 : 0.1)
            : alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.08 : 0.05),
          border: mine
            ? `1px solid ${alpha(theme.palette.primary.main, 0.18)}`
            : `1px solid ${theme.palette.divider}`,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        })}
      >
        <Typography sx={{ fontSize: "0.85rem", lineHeight: 1.45 }}>
          {msg.body}
        </Typography>
      </Box>
      <Typography
        sx={{ fontSize: "0.68rem", color: "text.secondary", mt: 0.4, px: 0.5 }}
      >
        {time}
      </Typography>
    </Box>
  );
}

/** Messages + composer. Remounted per conversation (key) so state resets cleanly. */
function ChatBody({ conv }: { conv: ChatConversation }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { startCall, openChat } = useChat();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const convId = conv.id;
  const isDraft = convId === DRAFT_CONVERSATION_ID;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: messagesKey(convId),
    queryFn: () => fetchMessages(convId, 1),
    staleTime: 10_000,
    enabled: !isDraft,
  });
  const messages = data?.results ?? [];
  const olderPage = data?.olderPage ?? null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      let real = conv;
      if (isDraft && conv.peer) {
        // Lazy materialization: the conversation is persisted only now.
        real = await ensureConversation(conv.peer.id);
      }
      const msg = await post<ChatMessage>(
        `/api/chat/conversations/${real.id}/messages/`,
        { body },
      );
      return { msg, real };
    },
    onSuccess: ({ msg, real }) => {
      if (real.id !== conv.id) {
        // Swap the draft for the persisted conversation so it appears in
        // the Chats lists immediately.
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        openChat(real);
      }
      queryClient.setQueryData<MessageList>(
        messagesKey(msg.conversation),
        (old) =>
          old && !old.results.some((m) => m.id === msg.id)
            ? { ...old, results: [...old.results, msg] }
            : old,
      );
      setText("");
    },
  });

  const loadOlder = async () => {
    if (!olderPage) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const page = await fetchMessages(convId, olderPage);
    queryClient.setQueryData<MessageList>(messagesKey(convId), (old) =>
      old
        ? { results: [...page.results, ...old.results], olderPage: page.olderPage }
        : old,
    );
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  };

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  };

  const rtl = i18n.dir() === "rtl";

  return (
    <>
      <Box
        ref={scrollRef}
        sx={(theme) => ({
          flex: 1,
          overflowY: "auto",
          px: 1.5,
          py: 1.5,
          overscrollBehavior: "contain",
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: 3,
            backgroundColor: alpha(theme.palette.text.secondary, 0.28),
          },
        })}
      >
        {olderPage && (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
            <ButtonBase
              onClick={() => void loadOlder()}
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "primary.main",
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
              }}
            >
              {t("chat.loadOlder")}
            </ButtonBase>
          </Box>
        )}
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                justifyContent: i % 2 ? "flex-end" : "flex-start",
                mb: 1,
              }}
            >
              <Skeleton
                variant="rounded"
                width={`${45 + i * 12}%`}
                height={38}
                sx={{ borderRadius: "14px" }}
              />
            </Box>
          ))
        ) : error ? (
          <Box>
            <ErrorAlert error={error} />
            <ButtonBase
              onClick={() => void refetch()}
              sx={{ mt: 1, fontSize: "0.8rem", fontWeight: 600, color: "primary.main" }}
            >
              {t("common.retry")}
            </ButtonBase>
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.85rem" }} color="text.secondary">
              {t("chat.noMessages")}
            </Typography>
          </Box>
        ) : (
          messages.map((m) =>
            m.kind === "call" && m.call ? (
              <CallEventMessage
                key={m.id}
                msg={m}
                mine={m.sender === user?.id}
                peerName={displayName(conv.peer)}
                onCallBack={
                  conv.peer
                    ? (mode) => startCall(conv.peer!, mode)
                    : undefined
                }
              />
            ) : (
              <Bubble key={m.id} msg={m} mine={m.sender === user?.id} />
            ),
          )
        )}
      </Box>

      <Divider />
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75, px: 1.25, py: 1 }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={3}
          placeholder={t("chat.typeMessage")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          slotProps={{ input: { sx: { fontSize: "0.88rem", borderRadius: "10px" } } }}
        />
        <IconButton
          size="small"
          onClick={(e) => setEmojiAnchor(e.currentTarget)}
          aria-label={t("chat.emoji")}
        >
          <InsertEmoticonOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={submit}
          disabled={!text.trim() || send.isPending}
          aria-label={t("chat.send")}
          sx={(theme2) => ({
            bgcolor: "primary.main",
            color: "#fff",
            borderRadius: "10px",
            "&:hover": { bgcolor: theme2.palette.primary.dark },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "action.disabled" },
          })}
        >
          <SendIcon fontSize="small" sx={rtl ? { transform: "scaleX(-1)" } : undefined} />
        </IconButton>
      </Box>
      {send.isError && (
        <Typography sx={{ px: 1.5, pb: 0.75, fontSize: "0.72rem" }} color="error">
          {t("chat.sendFailed")}
        </Typography>
      )}
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{ paper: { sx: { p: 1, borderRadius: "12px" } } }}
      >
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.25 }}>
          {EMOJIS.map((e) => (
            <ButtonBase
              key={e}
              onClick={() => {
                setText((v) => v + e);
                setEmojiAnchor(null);
              }}
              sx={{ fontSize: "1.25rem", p: 0.5, borderRadius: 1.5 }}
            >
              {e}
            </ButtonBase>
          ))}
        </Box>
      </Popover>
    </>
  );
}

export function ChatWindow() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const {
    openConversation: conv,
    openChat,
    closeChat,
    minimized,
    setMinimized,
    online,
    noteOnline,
    startCall,
    call,
  } = useChat();
  const queryClient = useQueryClient();

  const peer = conv?.peer;
  const peerOnline = peer ? online.has(peer.id) : false;
  const peerId = peer?.id ?? 0;

  // Fetch real presence for the peer when the window opens.
  useEffect(() => {
    if (!peerId) return;
    void get<{ online: number[] }>(`/api/chat/presence/?ids=${peerId}`).then(
      (r) => noteOnline(r.online),
    );
  }, [peerId, noteOnline]);

  if (!conv || !peer) return null;

  const callBusy = call !== null;

  // Materialize a draft conversation before signalling so the call and its
  // history event land in a real conversation.
  const callPeer = async (mode: "audio" | "video") => {
    if (conv.id === DRAFT_CONVERSATION_ID) {
      const real = await ensureConversation(peer.id);
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      openChat(real);
    }
    startCall(peer, mode);
  };

  const panel = (
    <Paper
      elevation={0}
      sx={{
        width: isMobile ? "100vw" : 380,
        height: isMobile ? "100dvh" : 500,
        maxHeight: isMobile ? "100dvh" : "min(620px, calc(100dvh - 100px))",
        display: "flex",
        flexDirection: "column",
        borderRadius: isMobile ? 0 : "16px",
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: "background.paper",
        backgroundImage: "none",
        overflow: "hidden",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 16px 44px rgba(0,0,0,0.55)"
            : "0 16px 44px rgba(16,18,20,0.18)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.75,
          py: 1.1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ position: "relative" }}>
          <ChatAvatar user={peer} size={36} />
          {peerOnline && (
            <Box
              sx={{
                position: "absolute",
                bottom: 0,
                insetInlineEnd: 0,
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: "#22C55E",
                border: `2px solid ${theme.palette.background.paper}`,
              }}
            />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700 }} noWrap>
            {displayName(peer)}
          </Typography>
          <Typography sx={{ fontSize: "0.7rem" }} color="text.secondary" noWrap>
            {peerOnline ? t("chat.online") : peer.job_title || t(`role.${peer.role}`)}
          </Typography>
        </Box>
        <Tooltip title={t("chat.voiceCall")}>
          <span>
            <IconButton
              size="small"
              disabled={callBusy}
              onClick={() => void callPeer("audio")}
              aria-label={t("chat.voiceCall")}
            >
              <PhoneOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("chat.videoCall")}>
          <span>
            <IconButton
              size="small"
              disabled={callBusy}
              onClick={() => void callPeer("video")}
              aria-label={t("chat.videoCall")}
            >
              <VideocamOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" aria-label={t("chat.options")}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        {!isMobile && (
          <IconButton
            size="small"
            onClick={() => setMinimized(true)}
            aria-label={t("chat.minimize")}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton size="small" onClick={closeChat} aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <ChatBody key={conv.id} conv={conv} />
    </Paper>
  );

  if (isMobile) {
    return (
      <Box sx={{ position: "fixed", inset: 0, zIndex: (t2) => t2.zIndex.modal + 1 }}>
        {panel}
      </Box>
    );
  }

  return minimized ? (
    <ButtonBase
      onClick={() => setMinimized(false)}
      sx={(theme2) => ({
        position: "fixed",
        bottom: 20,
        insetInlineEnd: 24,
        zIndex: theme2.zIndex.modal,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.9,
        borderRadius: "12px",
        border: `1px solid ${theme2.palette.divider}`,
        bgcolor: "background.paper",
        boxShadow: "0 8px 24px rgba(16,18,20,0.16)",
      })}
    >
      <ChatAvatar user={peer} size={28} />
      <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }} noWrap>
        {displayName(peer)}
      </Typography>
      <KeyboardArrowUpIcon fontSize="small" />
    </ButtonBase>
  ) : (
    <Box
      sx={{
        position: "fixed",
        bottom: 20,
        insetInlineEnd: 24,
        zIndex: (t2) => t2.zIndex.modal,
      }}
    >
      {panel}
    </Box>
  );
}
