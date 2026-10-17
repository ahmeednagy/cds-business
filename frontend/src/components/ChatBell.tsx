import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  alpha,
  Badge,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  Popover,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { get } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { displayName } from "../lib/chatFormat";
import { isRtlLanguage } from "../i18n";
import { useAuth } from "../lib/auth";
import {
  CHAT_UNREAD_KEY,
  CONVERSATIONS_KEY,
  DRAFT_CONVERSATION_ID,
} from "../features/chat/api";
import { messagePreview } from "../features/chat/callEventText";
import { useChat } from "../features/chat/context";
import { ChatAvatar } from "./ChatAvatar";
import type { ChatConversation, ChatUser, Page } from "../types";

const listScrollSx = {
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  scrollbarColor: (t: { palette: { text: { secondary: string } } }) =>
    `${alpha(t.palette.text.secondary, 0.28)} transparent`,
  "&::-webkit-scrollbar": { width: 6 },
  "&::-webkit-scrollbar-thumb": (t: { palette: { text: { secondary: string } } }) => ({
    borderRadius: 3,
    backgroundColor: alpha(t.palette.text.secondary, 0.28),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function RowSkeleton() {
  return (
    <Box sx={{ display: "flex", gap: 1.25, px: 2, py: 1.25, alignItems: "center" }}>
      <Skeleton variant="circular" width={40} height={40} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="50%" height={18} />
        <Skeleton width="80%" height={15} sx={{ mt: 0.5 }} />
      </Box>
    </Box>
  );
}

/** Directory picker shown inside the same popover when "New message" is hit. */
function NewMessagePanel({ onPicked, onClose }: { onPicked: (u: ChatUser) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const isRtl = isRtlLanguage(i18n.language);
  const [search, setSearch] = useState("");
  const Chevron = isRtl ? ChevronLeftIcon : ChevronRightIcon;
  const { data, isLoading } = useQuery({
    queryKey: ["chat", "contacts", search],
    queryFn: () =>
      get<Page<ChatUser>>(
        `/api/chat/contacts/?page_size=30&search=${encodeURIComponent(search)}`,
      ),
    staleTime: 30_000,
  });
  const users = data?.results ?? [];

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.25 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
          {t("chat.newMessage")}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t("common.close")}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ px: 2, pb: 1.25 }}>
        <TextField
          fullWidth
          size="small"
          autoFocus
          placeholder={t("chat.searchEmployees")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />,
            },
          }}
        />
      </Box>
      <Divider />
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, maxHeight: 300, ...listScrollSx }}>
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <Box component="li" key={i}>
              {i > 0 && <Divider />}
              <RowSkeleton />
            </Box>
          ))
        ) : users.length === 0 ? (
          <Box sx={{ py: 3, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.85rem" }} color="text.secondary">
              {t("chat.noEmployees")}
            </Typography>
          </Box>
        ) : (
          users.map((u, i) => (
            <Box component="li" key={u.id}>
              {i > 0 && <Divider />}
              <ButtonBase
                onClick={() => onPicked(u)}
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  width: "100%",
                  px: 2,
                  py: 1.1,
                  textAlign: "start",
                  "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                })}
              >
                <ChatAvatar user={u} size={38} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 700 }} noWrap>
                    {displayName(u)}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem" }} color="text.secondary" noWrap>
                    {u.job_title || t(`role.${u.role}`)}
                  </Typography>
                </Box>
                <Chevron fontSize="small" sx={{ color: "text.disabled" }} />
              </ButtonBase>
            </Box>
          ))
        )}
      </Box>
    </>
  );
}

export function ChatBell() {
  const { t, i18n } = useTranslation();
  const isRtl = isRtlLanguage(i18n.language);
  const navigate = useNavigate();
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const { openChat } = useChat();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [newMsgMode, setNewMsgMode] = useState(false);
  const open = Boolean(anchor);
  const ArrowIcon = isRtl ? ArrowBackIcon : ArrowForwardIcon;

  const { data: unread } = useQuery({
    queryKey: CHAT_UNREAD_KEY,
    queryFn: () => get<{ count: number }>("/api/chat/unread/"),
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () =>
      get<Page<ChatConversation>>("/api/chat/conversations/?page_size=50"),
    enabled: open,
    staleTime: 15_000,
  });

  const close = () => {
    setAnchor(null);
    setNewMsgMode(false);
  };

  const pickUser = (u: ChatUser) => {
    // Do NOT persist anything yet — a conversation is only created when
    // the user sends a message or places a call (lazy creation).
    close();
    openChat({
      id: DRAFT_CONVERSATION_ID,
      kind: "direct",
      peer: u,
      last_message: null,
      last_message_at: null,
      unread_count: 0,
    });
  };

  const convs = data?.results ?? [];
  const unreadConvs = convs.filter((c) => c.unread_count > 0).length;

  return (
    <>
      <Tooltip title={open ? "" : t("chat.title")}>
        <IconButton
          aria-label={t("chat.title")}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? "chat-popover" : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <Badge badgeContent={unread?.count} color="primary" max={99} invisible={!unread?.count}>
            <ChatBubbleOutlineOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        id="chat-popover"
        open={open}
        anchorEl={anchor}
        onClose={close}
        disableScrollLock
        marginThreshold={12}
        anchorOrigin={{ vertical: "bottom", horizontal: isRtl ? "left" : "right" }}
        transformOrigin={{ vertical: "top", horizontal: isRtl ? "left" : "right" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              mt: 1.25,
              width: { xs: "calc(100vw - 24px)", sm: 380 },
              maxWidth: 380,
              maxHeight: 430,
              borderRadius: "14px",
              border: `1px solid ${theme.palette.divider}`,
              bgcolor: "background.paper",
              backgroundImage: "none",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 12px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)"
                  : "0 12px 32px rgba(16,18,20,0.14), 0 2px 8px rgba(16,18,20,0.06)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }),
          },
        }}
      >
        {newMsgMode ? (
          <NewMessagePanel onPicked={(u) => void pickUser(u)} onClose={() => setNewMsgMode(false)} />
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, py: 1.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
                  {t("chat.title")}
                </Typography>
                {unreadConvs > 0 && (
                  <Box
                    sx={{
                      minWidth: 18,
                      height: 18,
                      px: 0.5,
                      borderRadius: 9,
                      bgcolor: "primary.main",
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {unreadConvs}
                  </Box>
                )}
              </Box>
              <ButtonBase
                onClick={() => setNewMsgMode(true)}
                sx={(theme) => ({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "primary.main",
                  borderRadius: "8px",
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                  px: 1,
                  py: 0.4,
                })}
              >
                <EditOutlinedIcon sx={{ fontSize: 15 }} />
                {t("chat.newMessage")}
              </ButtonBase>
            </Box>
            <Divider />
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, maxHeight: { xs: "55vh", sm: 330 }, ...listScrollSx }}>
              {isLoading ? (
                [0, 1, 2].map((i) => (
                  <Box component="li" key={i}>
                    {i > 0 && <Divider />}
                    <RowSkeleton />
                  </Box>
                ))
              ) : convs.length === 0 ? (
                <Box sx={{ py: 3.5, px: 3, textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    {t("chat.emptyTitle")}
                  </Typography>
                  <Typography sx={{ fontSize: "0.78rem", mt: 0.5 }} color="text.secondary">
                    {t("chat.emptyBody")}
                  </Typography>
                </Box>
              ) : (
                convs.map((c, i) => (
                  <Box component="li" key={c.id}>
                    {i > 0 && <Divider />}
                    <ButtonBase
                      onClick={() => {
                        close();
                        openChat(c);
                      }}
                      sx={(theme) => ({
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        width: "100%",
                        px: 2,
                        py: 1.1,
                        textAlign: "start",
                        bgcolor: c.unread_count
                          ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.05)
                          : "transparent",
                        "&:hover": {
                          bgcolor: c.unread_count
                            ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.08)
                            : alpha(theme.palette.text.primary, 0.04),
                        },
                      })}
                    >
                      <ChatAvatar user={c.peer} size={40} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography
                            sx={{ flex: 1, minWidth: 0, fontSize: "0.88rem", fontWeight: c.unread_count ? 700 : 600 }}
                            noWrap
                          >
                            {displayName(c.peer)}
                          </Typography>
                          <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", flexShrink: 0 }}>
                            {c.last_message_at ? relativeTime(c.last_message_at, i18n.language) : ""}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                          <Typography
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: "0.78rem",
                              color: "text.secondary",
                              fontWeight: c.unread_count ? 600 : 400,
                            }}
                            noWrap
                          >
                            {messagePreview(
                              c.last_message,
                              myId,
                              displayName(c.peer),
                              t,
                            ) ?? t("chat.startConversation")}
                          </Typography>
                          {c.unread_count > 0 && (
                            <Box
                              sx={{
                                minWidth: 18,
                                height: 18,
                                px: 0.5,
                                borderRadius: 9,
                                bgcolor: "primary.main",
                                color: "#fff",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </ButtonBase>
                  </Box>
                ))
              )}
            </Box>
            <Divider />
            <ButtonBase
              onClick={() => {
                close();
                navigate("/chat");
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                width: "100%",
                py: 1.25,
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "primary.main",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              {t("chat.viewAll")}
              <ArrowIcon sx={{ fontSize: 18 }} />
            </ButtonBase>
          </>
        )}
      </Popover>
    </>
  );
}
