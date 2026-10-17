import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  alpha,
  Box,
  Button,
  Card,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { ReactNode } from "react";

import { ErrorAlert, IconBadge } from "../components/ui";
import { get, post } from "../lib/api";
import { relativeTime } from "../lib/dates";
import { useNumberFormat } from "../lib/format";
import { iconFor, itemPath } from "../lib/notificationMeta";
import { isRtlLanguage } from "../i18n";
import type { AppNotification, Page } from "../types";

const PAGE_SIZE = 10;

type TabKey = "all" | "unread" | "read";

function RowSkeleton() {
  return (
    <Card
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2.5,
        py: 2.25,
        borderRadius: "14px",
      }}
    >
      <Skeleton variant="circular" width={8} height={8} />
      <Skeleton variant="circular" width={48} height={48} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="42%" height={22} />
        <Skeleton width="22%" height={16} sx={{ mt: 0.5 }} />
      </Box>
      <Skeleton variant="rounded" width={96} height={36} />
    </Card>
  );
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const nf = useNumberFormat();
  const isRtl = isRtlLanguage(i18n.language);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState<{
    anchor: HTMLElement;
    item: AppNotification;
  } | null>(null);

  // Debounce search so typing doesn't fire a request per keystroke.
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
  });
  if (tab === "unread") params.set("unread", "true");
  if (tab === "read") params.set("read", "true");
  if (typeFilter) params.set("item_type", typeFilter);
  if (q) params.set("search", q);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notifications", "list", tab, q, typeFilter, page],
    queryFn: () => get<Page<AppNotification>>(`/api/notifications/?${params}`),
    placeholderData: (prev) => prev,
  });

  // Stable totals for the summary cards / tab counts — independent of filters.
  const { data: allMeta } = useQuery({
    queryKey: ["notifications", "count-all"],
    queryFn: () =>
      get<Page<AppNotification>>("/api/notifications/?page_size=1"),
  });
  // Same query key + URL as the header bell badge so they share the cache.
  const { data: unreadMeta } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () =>
      get<Page<AppNotification>>("/api/notifications/?unread=true&page_size=1"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["unread-count"] });
  };
  const markRead = useMutation({
    mutationFn: (id: number) => post(`/api/notifications/${id}/read/`),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => post<{ marked: number }>("/api/notifications/read-all/"),
    onSuccess: invalidate,
  });

  const totalAll = allMeta?.count ?? 0;
  const totalUnread = unreadMeta?.count ?? 0;
  const totalRead = Math.max(0, totalAll - totalUnread);

  const items = data?.results ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const pageWindow = useMemo(() => {
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    if (pages.length <= 5) return pages;
    const start = Math.min(Math.max(1, page - 2), pageCount - 4);
    return pages.slice(start - 1, start + 4);
  }, [pageCount, page]);
  const PrevIcon = isRtl ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  const isFiltered = tab !== "all" || q !== "" || typeFilter !== "";
  const resetFilters = () => {
    setTab("all");
    setSearch("");
    setTypeFilter("");
    setPage(1);
  };

  // Type options: the real item_types the backend emits, plus any unseen
  // type that shows up in the loaded data.
  const typeOptions = useMemo(() => {
    const known = ["request", "timesheet"];
    const extra = Array.from(
      new Set((data?.results ?? []).map((n) => n.item_type)),
    ).filter((x) => !known.includes(x));
    return [...known, ...extra];
  }, [data]);

  const tabs: { key: TabKey; label: string; count: number; icon: ReactNode }[] =
    [
      {
        key: "all",
        label: t("notifications.tabAll"),
        count: totalAll,
        icon: <NotificationsNoneOutlinedIcon fontSize="small" />,
      },
      {
        key: "unread",
        label: t("notifications.tabUnread"),
        count: totalUnread,
        icon: <NotificationsActiveOutlinedIcon fontSize="small" />,
      },
      {
        key: "read",
        label: t("notifications.tabRead"),
        count: totalRead,
        icon: <DoneAllIcon fontSize="small" />,
      },
    ];

  const summary = [
    {
      label: t("notifications.summaryAll"),
      value: totalAll,
      caption: t("notifications.summaryAllCaption"),
      icon: <NotificationsNoneOutlinedIcon />,
      tint: "#64748B",
    },
    {
      label: t("notifications.summaryUnread"),
      value: totalUnread,
      caption: t("notifications.summaryUnreadCaption"),
      icon: <NotificationsActiveOutlinedIcon />,
      tint: "#E31E24",
    },
    {
      label: t("notifications.summaryRead"),
      value: totalRead,
      caption: t("notifications.summaryReadCaption"),
      icon: <DoneAllIcon />,
      tint: "#16A34A",
    },
  ];

  const menuItem = menuFor?.item;
  const menuPath = menuItem ? itemPath(menuItem) : null;

  return (
    <>
      {/* Page header */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          flexDirection: { xs: "column", sm: "row" },
          mb: 2.5,
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "1.75rem" },
              fontWeight: 800,
              lineHeight: 1.25,
              color: "text.primary",
            }}
          >
            {t("notifications.title")}
          </Typography>
          <Typography
            sx={{ fontSize: "0.95rem", mt: 0.5 }}
            color="text.secondary"
          >
            {t("notifications.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DoneAllIcon />}
          onClick={() => markAll.mutate()}
          disabled={totalUnread === 0 || markAll.isPending}
          sx={{
            height: 48,
            px: 2.5,
            borderRadius: "10px",
            borderColor: "divider",
            color: "text.primary",
            bgcolor: "background.paper",
            fontWeight: 600,
            textTransform: "none",
            flexShrink: 0,
          }}
        >
          {t("notifications.markAllRead")}
        </Button>
      </Box>

      {/* Summary cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: { xs: 1.5, md: 2 },
          mb: 2.5,
        }}
      >
        {summary.map((s) => (
          <Card
            key={s.label}
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 2,
              px: 2.5,
              py: 2.25,
              minHeight: 112,
              borderRadius: "16px",
              border: "1px solid",
              borderColor:
                theme.palette.mode === "dark"
                  ? alpha(s.tint, 0.3)
                  : alpha(s.tint, 0.18),
              bgcolor:
                theme.palette.mode === "dark"
                  ? alpha(s.tint, 0.1)
                  : alpha(s.tint, 0.05),
              boxShadow: "none",
            })}
          >
            <IconBadge icon={s.icon} tint={s.tint} size={48} />
            <Box>
              <Typography
                sx={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1.2 }}
              >
                {nf.format(s.value)}
              </Typography>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {s.label}
              </Typography>
              <Typography
                sx={{ fontSize: "0.8rem" }}
                color="text.secondary"
              >
                {s.caption}
              </Typography>
            </Box>
          </Card>
        ))}
      </Box>

      {/* Toolbar: segmented tabs + search + type filter */}
      <Card
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          px: 2,
          py: 1.5,
          mb: 2.5,
          borderRadius: "14px",
        }}
      >
        <Box
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", flex: "1 1 auto" }}
          role="tablist"
          aria-label={t("notifications.title")}
        >
          {tabs.map((tb) => {
            const active = tab === tb.key;
            return (
              <Button
                key={tb.key}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(tb.key);
                  setPage(1);
                }}
                startIcon={tb.icon}
                sx={(theme) => ({
                  height: 44,
                  px: 2,
                  borderRadius: "10px",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  gap: 0.5,
                  ...(active
                    ? {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        "&:hover": { bgcolor: "primary.dark" },
                      }
                    : {
                        color: "text.secondary",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.text.primary, 0.05),
                        },
                      }),
                })}
              >
                {tb.label}
                <Box
                  component="span"
                  sx={(theme) => ({
                    ms: 0.75,
                    minWidth: 22,
                    height: 22,
                    px: 0.5,
                    borderRadius: "11px",
                    display: "inline-grid",
                    placeItems: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    bgcolor: active
                      ? alpha(theme.palette.common.white, 0.25)
                      : alpha(theme.palette.text.primary, 0.08),
                  })}
                >
                  {nf.format(tb.count)}
                </Box>
              </Button>
            );
          })}
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            flexWrap: "wrap",
            flex: { xs: "1 1 100%", md: "0 0 auto" },
          }}
        >
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("notifications.searchPlaceholder")}
            inputProps={{ "aria-label": t("common.search") }}
            sx={{
              minWidth: { xs: "100%", sm: 240 },
              "& .MuiOutlinedInput-root": {
                height: 44,
                borderRadius: "10px",
                bgcolor: "background.paper",
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Select
            size="small"
            displayEmpty
            value={typeFilter}
            onChange={(e: SelectChangeEvent<string>) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            inputProps={{ "aria-label": t("notifications.typeAll") }}
            sx={{
              height: 44,
              minWidth: 150,
              borderRadius: "10px",
              bgcolor: "background.paper",
              fontSize: "0.9rem",
            }}
          >
            <MenuItem value="">{t("notifications.typeAll")}</MenuItem>
            {typeOptions.map((tp) => (
              <MenuItem key={tp} value={tp}>
                {t(`notifications.type.${tp}`, { defaultValue: tp })}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Card>

      {/* Notification list */}
      {isLoading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </Stack>
      ) : error ? (
        <Card sx={{ p: 3, borderRadius: "14px" }}>
          <ErrorAlert error={error} />
          <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
            <Button variant="outlined" onClick={() => refetch()}>
              {t("common.retry")}
            </Button>
          </Box>
        </Card>
      ) : items.length === 0 ? (
        <Card sx={{ borderRadius: "14px" }}>
          <Stack alignItems="center" spacing={1.5} sx={{ py: 8, px: 3 }}>
            <IconBadge
              icon={
                isFiltered ? (
                  <SearchOutlinedIcon />
                ) : (
                  <DoneAllIcon />
                )
              }
              tint="#64748B"
              size={64}
            />
            <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {isFiltered
                ? t("notifications.noMatch")
                : t("notifications.emptyTitle")}
            </Typography>
            {!isFiltered && (
              <Typography variant="body2" color="text.secondary">
                {t("notifications.emptyBody")}
              </Typography>
            )}
            {isFiltered && (
              <Button
                variant="outlined"
                onClick={resetFilters}
                sx={{ mt: 1, textTransform: "none", borderRadius: "10px" }}
              >
                {t("notifications.resetFilters")}
              </Button>
            )}
          </Stack>
        </Card>
      ) : (
        <Stack spacing={1.5} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
          {items.map((n) => {
            const path = itemPath(n);
            const { icon, tint } = iconFor(n);
            return (
              <Card
                key={n.id}
                component="li"
                onClick={path ? () => navigate(path) : undefined}
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: 2.5,
                  py: 2.25,
                  minHeight: 88,
                  borderRadius: "14px",
                  border: "1px solid",
                  borderColor: "divider",
                  borderInlineStart: n.is_read
                    ? `1px solid ${theme.palette.divider}`
                    : `3px solid ${theme.palette.primary.main}`,
                  boxShadow: "none",
                  cursor: path ? "pointer" : "default",
                  transition: "background-color 120ms ease",
                  bgcolor: n.is_read
                    ? "background.paper"
                    : alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === "dark" ? 0.12 : 0.05,
                      ),
                  "&:hover": path
                    ? {
                        bgcolor: n.is_read
                          ? alpha(theme.palette.text.primary, 0.02)
                          : alpha(
                              theme.palette.primary.main,
                              theme.palette.mode === "dark" ? 0.16 : 0.07,
                            ),
                      }
                    : {},
                })}
              >
                {/* Unread dot on the inline-start edge */}
                <Box
                  aria-hidden
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: n.is_read ? "transparent" : "primary.main",
                  }}
                />
                <IconBadge icon={icon} tint={tint} size={48} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: n.is_read ? 500 : 700,
                      fontSize: "0.95rem",
                      color: n.is_read ? "text.secondary" : "text.primary",
                    }}
                  >
                    {n.message}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                    title={new Date(n.created_at).toLocaleString(i18n.language)}
                  >
                    {relativeTime(n.created_at, i18n.language)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexShrink: 0,
                  }}
                >
                  {!n.is_read && (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead.mutate(n.id);
                      }}
                      disabled={markRead.isPending}
                      sx={(theme) => ({
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: "8px",
                        px: 1.5,
                        height: 36,
                        color: "primary.main",
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark" ? 0.2 : 0.1,
                        ),
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.2),
                        },
                      })}
                    >
                      {t("notifications.markRead")}
                    </Button>
                  )}
                  {(path || !n.is_read) && (
                    <IconButton
                      size="small"
                      aria-label={t("common.actions")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuFor({ anchor: e.currentTarget, item: n });
                      }}
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: "8px",
                      }}
                    >
                      <MoreHorizOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Pagination — outside the list, real API state. */}
      {data && data.count > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mt: 2.25,
            flexWrap: "wrap",
          }}
        >
          <Typography sx={{ fontSize: "0.9rem" }} color="text.secondary">
            {t("pagination.page", {
              page,
              pages: pageCount,
              count: data.count,
            })}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              size="small"
              aria-label={t("pagination.previous")}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              sx={{ border: 1, borderColor: "divider", borderRadius: "50%" }}
            >
              <PrevIcon fontSize="small" />
            </IconButton>
            {pageWindow.map((p) => (
              <IconButton
                key={p}
                size="small"
                aria-label={`${p}`}
                aria-current={p === page ? "page" : undefined}
                onClick={() => setPage(p)}
                sx={(theme) => ({
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  border: 1,
                  borderColor:
                    p === page ? "transparent" : theme.palette.divider,
                  ...(p === page
                    ? {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        "&:hover": { bgcolor: "primary.dark" },
                      }
                    : {}),
                })}
              >
                {nf.format(p)}
              </IconButton>
            ))}
            <IconButton
              size="small"
              aria-label={t("pagination.next")}
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              sx={{ border: 1, borderColor: "divider", borderRadius: "50%" }}
            >
              <NextIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Row actions — only real actions: mark read / open destination. */}
      <Menu
        anchorEl={menuFor?.anchor}
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
      >
        {menuItem && !menuItem.is_read && (
          <MenuItem
            onClick={() => {
              const id = menuItem.id;
              setMenuFor(null);
              markRead.mutate(id);
            }}
          >
            <ListItemIcon>
              <DoneAllIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("notifications.markRead")}</ListItemText>
          </MenuItem>
        )}
        {menuPath && (
          <MenuItem
            onClick={() => {
              const to = menuPath;
              setMenuFor(null);
              navigate(to);
            }}
          >
            <ListItemIcon>
              <ChevronRightIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("notifications.view")}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
