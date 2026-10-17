import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { alpha, Box, ButtonBase, Divider, Skeleton, Typography } from "@mui/material";

import { get } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { relativeTime } from "../../lib/dates";
import { ChatAvatar } from "../../components/ChatAvatar";
import { displayName } from "../../lib/chatFormat";
import { EmptyState, PageHeader, SectionCard } from "../../components/ui";
import type { ChatConversation, Page } from "../../types";
import { CONVERSATIONS_KEY } from "./api";
import { messagePreview } from "./callEventText";
import { useChat } from "./context";

export default function ChatsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { openChat } = useChat();

  const { data, isLoading, error } = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () =>
      get<Page<ChatConversation>>("/api/chat/conversations/?page_size=100"),
  });

  const convs = data?.results ?? [];

  return (
    <Box>
      <PageHeader title={t("chat.title")} subtitle={t("chat.pageSubtitle")} />
      <SectionCard>
        {isLoading ? (
          [0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: "flex", gap: 1.5, p: 2 }}>
              <Skeleton variant="circular" width={44} height={44} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="40%" height={20} />
                <Skeleton width="70%" height={16} sx={{ mt: 0.5 }} />
              </Box>
            </Box>
          ))
        ) : error ? (
          <EmptyState message={t("errors.loadFailed")} />
        ) : convs.length === 0 ? (
          <EmptyState
            message={`${t("chat.emptyTitle")} — ${t("chat.emptyBody")}`}
          />
        ) : (
          convs.map((c, i) => (
            <Box key={c.id}>
              {i > 0 && <Divider />}
              <ButtonBase
                onClick={() => openChat(c)}
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  width: "100%",
                  px: 2.5,
                  py: 1.75,
                  textAlign: "start",
                  "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                })}
              >
                <ChatAvatar user={c.peer} size={44} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ flex: 1, fontSize: "0.95rem", fontWeight: 700 }} noWrap>
                      {displayName(c.peer)}
                    </Typography>
                    <Typography sx={{ fontSize: "0.75rem" }} color="text.secondary">
                      {c.last_message_at ? relativeTime(c.last_message_at, i18n.language) : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                    <Typography sx={{ flex: 1, fontSize: "0.82rem" }} color="text.secondary" noWrap>
                      {messagePreview(
                        c.last_message,
                        user?.id ?? 0,
                        displayName(c.peer),
                        t,
                      ) ?? t("chat.startConversation")}
                    </Typography>
                    {c.unread_count > 0 && (
                      <Box
                        sx={{
                          minWidth: 20,
                          height: 20,
                          px: 0.6,
                          borderRadius: 10,
                          bgcolor: "primary.main",
                          color: "#fff",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
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
      </SectionCard>
    </Box>
  );
}
