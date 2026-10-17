import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { get, post } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { isRtlLanguage } from "../i18n";
import { ErrorAlert, IconBadge } from "./ui";
import { iconFor, itemPath } from "../lib/notificationMeta";
import type { AppNotification, Page } from "../types";

const LIST_KEY = ["notifications", "dropdown"] as const;
const UNREAD_KEY = ["unread-count"] as const;
const PAGE_SIZE = 100; // StandardPagination max — loop pages for ALL unread

/** Short row title from real metadata only — the server-generated verb in
 * `message` plus the item_type label. Falls back to the item type alone. */
function eventKey(n: AppNotification): string | null {
  const m = n.message.toLowerCase();
  if (m.includes("approved")) return "approved";
  if (m.includes("rejected")) return "rejected";
  if (m.includes("returned")) return "returned";
  if (m.includes("resubmitted")) return "resubmitted";
  if (m.includes("withdrawn")) return "withdrawn";
  if (m.includes("awaiting") || m.includes("pending")) return "awaiting";
  return null;
}

function RowSkeleton() {
  return (
    <Box sx={{ display: "flex", gap: 1.25, px: 2, py: 1.25 }}>
      <Skeleton variant="circular" width={34} height={34} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="55%" height={18} />
        <Skeleton width="85%" height={15} sx={{ mt: 0.5 }} />
        <Skeleton width="30%" height={13} sx={{ mt: 0.5 }} />
      </Box>
    </Box>
  );
}

/**
 * Header bell + notification dropdown. Same state as the Notifications page:
 * the `["notifications", …]` / `["unread-count"]` cache keys are shared, so
 * badge, dropdown and page stay synchronized without a second store.
 */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const isRtl = isRtlLanguage(i18n.language);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const { data: unread } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () =>
      get<{ count: number }>("/api/notifications/?unread=true&page_size=1"),
    refetchInterval: 60_000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => {
      // Fetch every unread notification, newest first (backend ordering),
      // paginating through the server's 100-per-page cap.
      const results: AppNotification[] = [];
      for (let page = 1; ; page += 1) {
        const p = await get<Page<AppNotification>>(
          `/api/notifications/?unread=true&page_size=${PAGE_SIZE}&page=${page}`,
        );
        results.push(...p.results);
        if (!p.next) {
          return { ...p, next: null, previous: null, results };
        }
      }
    },
    enabled: open,
    staleTime: 30_000,
  });

  const close = () => setAnchor(null);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => post(`/api/notifications/${id}/read/`),
    onSuccess: (_v, id) => {
      // The dropdown lists unread only — drop the row immediately.
      queryClient.setQueryData<Page<AppNotification>>(LIST_KEY, (old) =>
        old
          ? {
              ...old,
              count: Math.max(0, old.count - 1),
              results: old.results.filter((n) => n.id !== id),
            }
          : old,
      );
      queryClient.setQueryData<{ count: number }>(UNREAD_KEY, (old) =>
        old ? { ...old, count: Math.max(0, old.count - 1) } : old,
      );
      invalidate();
    },
  });
  const markAll = useMutation({
    mutationFn: () => post("/api/notifications/read-all/"),
    onSuccess: () => {
      // Clear the unread list immediately — the empty state shows.
      queryClient.setQueryData<Page<AppNotification>>(LIST_KEY, (old) =>
        old ? { ...old, count: 0, results: [] } : old,
      );
      queryClient.setQueryData(UNREAD_KEY, { count: 0 });
      invalidate();
    },
  });

  const items = data?.results ?? [];
  const unreadCount = unread?.count ?? 0;
  const ArrowIcon = isRtl ? ArrowBackIcon : ArrowForwardIcon;

  const openRow = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const path = itemPath(n);
    if (path) {
      close();
      navigate(path);
    }
  };

  const titleFor = (n: AppNotification) => {
    const item = t(`notifications.type.${n.item_type}`, {
      defaultValue: n.item_type,
    });
    const key = eventKey(n);
    return key
      ? t(`notifications.event.${key}`, { item })
      : item;
  };

  return (
    <>
      <Tooltip title={open ? "" : t("nav.notifications")}>
        <IconButton
          aria-label={t("nav.notifications")}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? "notifications-popover" : undefined}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <Badge
            badgeContent={unread?.count}
            color="primary"
            max={99}
            variant={unread?.count ? "standard" : "dot"}
            invisible={!unread?.count}
          >
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        id="notifications-popover"
        open={open}
        anchorEl={anchor}
        onClose={close}
        disableScrollLock
        marginThreshold={12}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: isRtl ? "left" : "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: isRtl ? "left" : "right",
        }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              mt: 1.25,
              width: { xs: "calc(100vw - 24px)", sm: 360 },
              maxWidth: 360,
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
            }),
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            py: 1.25,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
            {t("notifications.title")}
          </Typography>
          <ButtonBase
            onClick={() => markAll.mutate()}
            disabled={unreadCount === 0 || markAll.isPending}
            sx={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "primary.main",
              borderRadius: "8px",
              px: 1,
              py: 0.5,
              "&.Mui-disabled": { color: "text.disabled" },
            }}
          >
            {t("notifications.markAllRead")}
          </ButtonBase>
        </Box>
        <Divider />

        {/* All unread — header/footer stay put, only this list scrolls. */}
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            maxHeight: { xs: "55vh", sm: 340 },
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
            scrollbarColor: (theme) =>
              `${alpha(theme.palette.text.secondary, 0.28)} transparent`,
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": (theme) => ({
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.text.secondary, 0.28),
            }),
          }}
        >
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Box component="li" key={i}>
                {i > 0 && <Divider />}
                <RowSkeleton />
              </Box>
            ))
          ) : error ? (
            <Box sx={{ p: 2.5 }}>
              <ErrorAlert error={error} />
              <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
                <ButtonBase
                  onClick={() => refetch()}
                  sx={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "primary.main",
                    borderRadius: "8px",
                    px: 1.5,
                    py: 0.75,
                  }}
                >
                  {t("common.retry")}
                </ButtonBase>
              </Box>
            </Box>
          ) : items.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                py: 3,
                px: 3,
              }}
            >
              <IconBadge icon={<DoneAllIcon />} tint="#64748B" size={40} />
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {t("notifications.emptyTitle")}
              </Typography>
              <Typography
                sx={{ fontSize: "0.78rem" }}
                color="text.secondary"
                align="center"
              >
                {t("notifications.emptyBody")}
              </Typography>
            </Box>
          ) : (
            items.map((n, i) => {
              const { icon, tint } = iconFor(n);
              return (
                <Box component="li" key={n.id}>
                  {i > 0 && <Divider />}
                  <ButtonBase
                    onClick={() => openRow(n)}
                    sx={(theme) => ({
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.25,
                      width: "100%",
                      textAlign: "start",
                      px: 2,
                      py: 1.25,
                      bgcolor: n.is_read
                        ? "transparent"
                        : alpha(
                            theme.palette.primary.main,
                            theme.palette.mode === "dark" ? 0.12 : 0.05,
                          ),
                      "&:hover": {
                        bgcolor: n.is_read
                          ? alpha(theme.palette.text.primary, 0.03)
                          : alpha(
                              theme.palette.primary.main,
                              theme.palette.mode === "dark" ? 0.16 : 0.08,
                            ),
                      },
                    })}
                  >
                    <IconBadge icon={icon} tint={tint} size={34} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <Typography
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: "0.85rem",
                            fontWeight: n.is_read ? 600 : 700,
                            lineHeight: 1.3,
                          }}
                          noWrap
                        >
                          {titleFor(n)}
                        </Typography>
                        {!n.is_read && (
                          <Box
                            aria-hidden
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: "primary.main",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: "0.78rem",
                          color: "text.secondary",
                          mt: 0.25,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {n.message}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.72rem",
                          color: "text.secondary",
                          mt: 0.25,
                        }}
                        title={new Date(n.created_at).toLocaleString(
                          i18n.language,
                        )}
                      >
                        {relativeTime(n.created_at, i18n.language)}
                      </Typography>
                    </Box>
                  </ButtonBase>
                </Box>
              );
            })
          )}
        </Box>
        <Divider />

        {/* Footer */}
        <ButtonBase
          onClick={() => {
            close();
            navigate("/notifications");
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
          {t("notifications.viewAll")}
          <ArrowIcon sx={{ fontSize: 18 }} />
        </ButtonBase>
      </Popover>
    </>
  );
}
