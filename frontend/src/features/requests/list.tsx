import { useMemo, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import FlightTakeoffOutlinedIcon from "@mui/icons-material/FlightTakeoffOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import {
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  IconBadge,
  StatusBadge,
  TableSkeleton,
} from "../../components/ui";
import { get } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { businessWeek, localISO, mondayOf } from "../../lib/dates";
import { useNumberFormat } from "../../lib/format";
import { isRtlLanguage } from "../../i18n";
import type { Page, ReportScope, RequestItem, RequestType } from "../../types";

const STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "RETURNED",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

const RANGE_PRESETS = [
  "",
  "this_week",
  "last_week",
  "last_4_weeks",
  "this_month",
  "last_month",
] as const;
type RangePreset = (typeof RANGE_PRESETS)[number];

const RANGE_LABEL_KEY: Record<RangePreset, string> = {
  "": "allTime",
  this_week: "thisWeek",
  last_week: "lastWeek",
  last_4_weeks: "last4Weeks",
  this_month: "thisMonth",
  last_month: "lastMonth",
};

/** Calendar-date range presets resolved to date_from/date_to filters on
 * submitted_at. Week presets follow the project's Sun–Sat business week. */
function resolveRange(preset: RangePreset): {
  from?: string;
  to?: string;
  start?: Date;
  end?: Date;
} {
  if (!preset) return {};
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d;
  };
  let start: Date;
  let end: Date;
  switch (preset) {
    case "this_week":
      ({ start, end } = businessWeek(mondayOf(today)));
      break;
    case "last_week":
      ({ start, end } = businessWeek(mondayOf(day(-7))));
      break;
    case "last_4_weeks":
      start = businessWeek(mondayOf(day(-21))).start;
      end = businessWeek(mondayOf(today)).end;
      break;
    case "this_month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "last_month":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
  }
  return { from: localISO(start), to: localISO(end), start, end };
}

/** Decorative request-type icon — heuristic on the (localized) type name,
 * falls back to a generic assignment glyph. Purely visual. */
function typeIcon(name: string): ReactNode {
  const n = name.toLowerCase();
  if (/leave|vacation|sick|إجازة/.test(n)) return <EventNoteOutlinedIcon />;
  if (/loan|advance|قرض|سلفة/.test(n))
    return <AccountBalanceWalletOutlinedIcon />;
  if (/travel|flight|سفر/.test(n)) return <FlightTakeoffOutlinedIcon />;
  if (/letter|document|certificate|خطاب|شهادة/.test(n))
    return <DescriptionOutlinedIcon />;
  return <AssignmentOutlinedIcon />;
}

interface Filters {
  search: string;
  status: string;
  typeId: string;
  range: RangePreset;
  pendingReview: boolean;
}
const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  typeId: "",
  range: "",
  pendingReview: false,
};

/* ---------- Summary stat card ---------- */

function StatCard({
  icon,
  tint,
  bg,
  value,
  label,
  labelColor,
  caption,
}: {
  icon: ReactNode;
  tint: string;
  bg: string;
  value: ReactNode;
  label: string;
  labelColor?: string;
  caption: string;
}) {
  return (
    <Card
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        borderRadius: "16px",
        height: "100%",
        bgcolor: theme.palette.mode === "dark" ? alpha(tint, 0.14) : bg,
        borderColor: alpha(tint, theme.palette.mode === "dark" ? 0.35 : 0.25),
      })}
    >
      {/* Decorative mini-bars — purely ornamental, low contrast. */}
      <Box
        aria-hidden
        sx={(theme) => ({
          position: "absolute",
          bottom: 14,
          insetInlineEnd: 18,
          display: "flex",
          alignItems: "flex-end",
          gap: "4px",
          opacity: theme.palette.mode === "dark" ? 0.25 : 0.35,
          "& span": {
            display: "block",
            width: 7,
            borderRadius: "3px 3px 0 0",
            bgcolor: tint,
          },
        })}
      >
        {[14, 22, 30, 20, 26, 34].map((h, i) => (
          <Box component="span" key={i} sx={{ height: h }} />
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 3.5 }}>
        <IconBadge icon={icon} tint={tint} size={56} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="p"
            fontWeight={800}
            sx={{ fontSize: "1.7rem", lineHeight: 1.2 }}
          >
            {value}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: labelColor ?? "text.primary",
            }}
            noWrap
          >
            {label}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem" }} color="text.secondary" noWrap>
            {caption}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

/* ---------- Labeled filter field ---------- */

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <FormControl fullWidth size="small">
      <Typography
        component="label"
        sx={{ fontSize: "0.85rem", fontWeight: 600, mb: 0.75 }}
        color="text.primary"
      >
        {label}
      </Typography>
      {children}
    </FormControl>
  );
}

const controlSx = {
  height: 50,
  borderRadius: "10px",
  "& .MuiSelect-select": { display: "flex", alignItems: "center" },
} as const;

export default function RequestListPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nf = useNumberFormat();
  const isRtl = isRtlLanguage(i18n.language);

  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("");
  // Deep links (dashboard KPIs → ?status=, header search → ?search=) seed the
  // draft AND applied filters so they take effect immediately.
  const [draft, setDraft] = useState<Filters>(() => {
    const s = searchParams.get("status") ?? "";
    return {
      ...EMPTY_FILTERS,
      status: STATUSES.includes(s) ? s : "",
      search: searchParams.get("search") ?? "",
    };
  });
  const [applied, setApplied] = useState<Filters>(draft);
  const [menuFor, setMenuFor] = useState<{
    anchor: HTMLElement;
    item: RequestItem;
  } | null>(null);

  const { data: types } = useQuery({
    queryKey: ["request-types"],
    queryFn: () => get<Page<RequestType>>("/api/request-types/?page_size=100"),
  });

  // Submitter display names from the caller's authorized report scope —
  // same source used elsewhere; falls back to the email the API returns.
  const { data: scope } = useQuery({
    queryKey: ["reports", "scope"],
    queryFn: () => get<ReportScope>("/api/reports/scope/"),
  });
  const canReview = user?.role === "MANAGER" || user?.role === "HR";
  const submitterName = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of scope?.employees ?? []) m.set(e.id, e.name || e.email);
    return m;
  }, [scope]);

  const rangeParams = useMemo(() => resolveRange(applied.range), [applied.range]);
  const draftRange = useMemo(() => resolveRange(draft.range), [draft.range]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    if (applied.search) p.set("search", applied.search);
    if (applied.typeId) p.set("request_type", applied.typeId);
    if (rangeParams.from) p.set("date_from", rangeParams.from);
    if (rangeParams.to) p.set("date_to", rangeParams.to);
    if (applied.pendingReview) p.set("pending_review", "true");
    return p;
  }, [applied, rangeParams]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(page));
    if (applied.status) p.set("status", applied.status);
    if (ordering) p.set("ordering", ordering);
    return p.toString();
  }, [baseParams, page, applied.status, ordering]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["requests", queryString],
    queryFn: () => get<Page<RequestItem>>(`/api/requests/?${queryString}`),
  });

  // Summary cards = the status breakdown of the filtered set — they apply
  // every filter EXCEPT status itself (the cards show the distribution).
  const countKey = useMemo(
    () => [
      applied.search,
      applied.typeId,
      applied.range,
      applied.pendingReview,
    ],
    [applied],
  );
  const countQueries = useQueries({
    queries: ["", "APPROVED", "PENDING", "IN_REVIEW", "REJECTED"].map((s) => ({
      queryKey: ["requests", "count", s, ...countKey],
      queryFn: () => {
        const p = new URLSearchParams(baseParams);
        p.set("page", "1");
        p.set("page_size", "1");
        if (s) p.set("status", s);
        return get<Page<RequestItem>>(`/api/requests/?${p}`);
      },
    })),
  });
  const [totalQ, approvedQ, pendingQ, inReviewQ, rejectedQ] = countQueries;
  const total = totalQ.data?.count ?? data?.count ?? 0;
  const approvedCount = approvedQ.data?.count ?? 0;
  const pendingCount = (pendingQ.data?.count ?? 0) + (inReviewQ.data?.count ?? 0);
  const rejectedCount = rejectedQ.data?.count ?? 0;
  const pct = (n: number) =>
    total > 0 ? `${nf.format(Math.round((n / total) * 100))}%` : `${nf.format(0)}%`;

  const hasFilters = Boolean(
    applied.search ||
      applied.status ||
      applied.typeId ||
      applied.range ||
      applied.pendingReview,
  );

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
  };
  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const toggleSort = (field: string) => {
    setOrdering((o) => (o === field ? `-${field}` : o === `-${field}` ? "" : field));
    setPage(1);
  };

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const fmtDateShort = (d: Date) =>
    d.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  const fmtRangeSpan = (s: Date, e: Date) =>
    `${fmtDateShort(s)} – ${fmtDate(e)}`;

  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / 25));
  const pageWindow = useMemo(() => {
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    if (pages.length <= 5) return pages;
    const start = Math.min(Math.max(1, page - 2), pageCount - 4);
    return pages.slice(start - 1, start + 4);
  }, [pageCount, page]);

  const PrevIcon = isRtl ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  const menuItem = menuFor?.item;
  const menuActions = useMemo(() => {
    if (!menuItem || !user) return [];
    const items: { key: string; icon: ReactNode; label: string }[] = [
      {
        key: "view",
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        label: t("requests.action.view"),
      },
    ];
    const reviewable =
      menuItem.status === "PENDING" || menuItem.status === "IN_REVIEW";
    if (reviewable && menuItem.current_actor_role === user.role) {
      items.push({
        key: "review",
        icon: <RateReviewOutlinedIcon fontSize="small" />,
        label: t("requests.action.review"),
      });
    }
    if (menuItem.submitter === user.id && menuItem.status === "PENDING") {
      items.push({
        key: "withdraw",
        icon: <UndoOutlinedIcon fontSize="small" />,
        label: t("requests.action.withdraw"),
      });
    }
    if (menuItem.submitter === user.id && menuItem.status === "RETURNED") {
      items.push({
        key: "resubmit",
        icon: <ReplayOutlinedIcon fontSize="small" />,
        label: t("requests.action.resubmit"),
      });
    }
    return items;
  }, [menuItem, user, t]);

  return (
    <>
      {/* Page heading — large bold title + subtitle, New request right. */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              fontSize: "1.75rem",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "text.primary",
            }}
          >
            {t("requests.title")}
          </Typography>
          <Typography sx={{ fontSize: "0.95rem", mt: 0.25 }} color="text.secondary">
            {t("requests.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => navigate("/requests/new")}
          sx={{
            height: 52,
            borderRadius: "12px",
            px: 3,
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          {t("requests.new")}
        </Button>
      </Box>

      {/* Filter panel — draft state applies on Apply; Clear resets. */}
      <Card sx={{ borderRadius: "16px", px: 3, py: 2.5, mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            alignItems: "end",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              // Reference proportions: Search ~25%, Status/Type/Range ~18%
              // each, then compact Clear/Apply flush right.
              lg: "minmax(0,25fr) minmax(0,18fr) minmax(0,18fr) minmax(0,18fr) auto auto",
            },
          }}
        >
          <FilterField label={t("common.search")}>
            <TextField
              size="small"
              placeholder={t("requests.searchPlaceholder")}
              value={draft.search}
              onChange={(e) =>
                setDraft((d) => ({ ...d, search: e.target.value }))
              }
              sx={{ "& .MuiOutlinedInput-root": controlSx }}
              inputProps={{ "aria-label": t("common.search") }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  </InputAdornment>
                ),
              }}
            />
          </FilterField>

          <FilterField label={t("common.status")}>
            <Select
              value={draft.status}
              displayEmpty
              onChange={(e) =>
                setDraft((d) => ({ ...d, status: e.target.value }))
              }
              sx={controlSx}
              inputProps={{ "aria-label": t("common.status") }}
            >
              <MenuItem value="">{t("requests.allStatuses")}</MenuItem>
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`status.${s}`)}
                </MenuItem>
              ))}
            </Select>
          </FilterField>

          <FilterField label={t("requests.type")}>
            <Select
              value={draft.typeId}
              displayEmpty
              onChange={(e) =>
                setDraft((d) => ({ ...d, typeId: e.target.value }))
              }
              sx={controlSx}
              inputProps={{ "aria-label": t("requests.type") }}
            >
              <MenuItem value="">{t("requests.allTypes")}</MenuItem>
              {(types?.results ?? []).map((rt) => (
                <MenuItem key={rt.id} value={String(rt.id)}>
                  {rt.name}
                </MenuItem>
              ))}
            </Select>
          </FilterField>

          <FilterField label={t("requests.filters.dateRange")}>
            <Select
              value={draft.range}
              displayEmpty
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  range: e.target.value as RangePreset,
                }))
              }
              sx={controlSx}
              inputProps={{ "aria-label": t("requests.filters.dateRange") }}
              startAdornment={
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  <CalendarMonthOutlinedIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              }
              renderValue={() =>
                draft.range ? (
                  <Typography component="span" sx={{ fontSize: "0.95rem" }} noWrap>
                    {fmtRangeSpan(draftRange.start!, draftRange.end!)}
                  </Typography>
                ) : (
                  <Typography component="span" sx={{ fontSize: "0.95rem" }}>
                    {t("requests.filters.allTime")}
                  </Typography>
                )
              }
            >
              {RANGE_PRESETS.map((p) => {
                const r = resolveRange(p);
                return (
                  <MenuItem key={p || "all"} value={p}>
                    <Box>
                      <Typography sx={{ fontSize: "0.95rem" }}>
                        {t(`requests.filters.${RANGE_LABEL_KEY[p]}`)}
                      </Typography>
                      {r.start && (
                        <Typography
                          sx={{ fontSize: "0.8rem" }}
                          color="text.secondary"
                        >
                          {fmtRangeSpan(r.start, r.end!)}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FilterField>

          <Button
            variant="outlined"
            onClick={clearFilters}
            sx={{ height: 50, borderRadius: "10px", px: 3, justifySelf: "end" }}
          >
            {t("requests.filters.clear")}
          </Button>
          <Button
            variant="contained"
            startIcon={<FilterAltOutlinedIcon />}
            onClick={applyFilters}
            sx={{ height: 50, borderRadius: "10px", px: 3, justifySelf: "end" }}
          >
            {t("requests.filters.apply")}
          </Button>
        </Box>

        {canReview && (
          <FormControlLabel
            sx={{ mt: 1.5 }}
            control={
              <Checkbox
                size="small"
                checked={draft.pendingReview}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, pendingReview: e.target.checked }))
                }
              />
            }
            label={
              <Typography variant="body2">
                {t("requests.awaitingMyReview")}
              </Typography>
            }
          />
        )}
      </Card>

      {/* Summary cards — counts of the current filtered set. */}
      {isLoading ? (
        <Box sx={{ mb: 3 }}>
          <CardSkeleton cards={4} />
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: "17px",
            mb: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          <StatCard
            icon={<AssignmentOutlinedIcon />}
            tint="#E31E24"
            bg="#FADADD"
            value={nf.format(total)}
            label={t("requests.summary.total")}
            caption={t("requests.summary.inSelectedPeriod")}
          />
          <StatCard
            icon={<CheckCircleOutlineIcon />}
            tint="#2F7D4F"
            bg="#D8EDD9"
            value={nf.format(approvedCount)}
            label={t("requests.summary.approved")}
            labelColor="#2F7D4F"
            caption={t("requests.summary.ofTotal", { pct: pct(approvedCount) })}
          />
          <StatCard
            icon={<ScheduleOutlinedIcon />}
            tint="#B07A1E"
            bg="#FDE8C8"
            value={nf.format(pendingCount)}
            label={t("requests.summary.pending")}
            labelColor="#B07A1E"
            caption={t("requests.summary.ofTotal", { pct: pct(pendingCount) })}
          />
          <StatCard
            icon={<CancelOutlinedIcon />}
            tint="#2F6FED"
            bg="#DDE8F5"
            value={nf.format(rejectedCount)}
            label={t("requests.summary.rejected")}
            labelColor="#2F6FED"
            caption={t("requests.summary.ofTotal", { pct: pct(rejectedCount) })}
          />
        </Box>
      )}

      {error && <ErrorAlert error={error} />}
      {isLoading && <TableSkeleton />}

      {data && (
        <Card sx={{ borderRadius: "16px" }}>
          {data.results.length === 0 ? (
            <EmptyState
              message={
                hasFilters
                  ? t("requests.noFilterResults")
                  : t("requests.empty")
              }
              icon={
                <AssignmentOutlinedIcon
                  sx={{ fontSize: 40, color: "text.disabled" }}
                />
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={clearFilters}
                  >
                    {t("requests.clearFilters")}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate("/requests/new")}
                  >
                    {t("requests.new")}
                  </Button>
                )
              }
            />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table aria-label={t("requests.title")}>
                <TableHead>
                  <TableRow
                    sx={(theme) => ({
                      bgcolor:
                        theme.palette.mode === "dark"
                          ? theme.palette.action.hover
                          : "#F7F8F9",
                      "& th": {
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        color: "text.secondary",
                        textTransform: "uppercase",
                        borderBottom: "none",
                        px: 3,
                        py: 1.75,
                        whiteSpace: "nowrap",
                      },
                    })}
                  >
                    {(
                      [
                        ["request_type__name", t("requests.type")],
                        ["submitter__email", t("requests.submitter")],
                        ["status", t("common.status")],
                        ["submitted_at", t("requests.submitted")],
                        ["current_actor_role", t("requests.reviewer")],
                        [null, t("common.actions")],
                      ] as [string | null, string][]
                    ).map(([field, label]) => (
                      <TableCell key={label}>
                        {field ? (
                          <TableSortLabel
                            active={ordering.replace("-", "") === field}
                            direction={ordering.startsWith("-") ? "desc" : "asc"}
                            onClick={() => toggleSort(field)}
                          >
                            {label}
                          </TableSortLabel>
                        ) : (
                          label
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.results.map((r) => {
                    const name = submitterName.get(r.submitter);
                    const submitted = r.submitted_at
                      ? new Date(r.submitted_at)
                      : null;
                    return (
                      <TableRow
                        key={r.id}
                        hover
                        onClick={() => navigate(`/requests/${r.id}`)}
                        sx={{
                          cursor: "pointer",
                          "& td": {
                            px: 3,
                            py: 1.75,
                            fontSize: "0.95rem",
                            borderColor: "divider",
                          },
                          "&:last-child td": { borderBottom: "none" },
                        }}
                      >
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <Box
                              aria-hidden
                              sx={(theme) => ({
                                width: 40,
                                height: 40,
                                flexShrink: 0,
                                borderRadius: "10px",
                                display: "grid",
                                placeItems: "center",
                                bgcolor:
                                  theme.palette.mode === "dark"
                                    ? alpha("#E31E24", 0.18)
                                    : "#FBE4E5",
                                color: "#E31E24",
                              })}
                            >
                              {typeIcon(r.request_type_name)}
                            </Box>
                            <Typography
                              sx={{
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                "&:hover": { textDecoration: "underline" },
                              }}
                            >
                              {r.request_type_name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <Avatar
                              sx={(theme) => ({
                                width: 34,
                                height: 34,
                                fontSize: "0.9rem",
                                fontWeight: 700,
                                bgcolor:
                                  theme.palette.mode === "dark"
                                    ? alpha("#4A4D52", 0.45)
                                    : "#EDEFF2",
                                color: "text.secondary",
                              })}
                            >
                              {(name ?? r.submitter_email)
                                .charAt(0)
                                .toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{ fontSize: "0.95rem", fontWeight: 600 }}
                                noWrap
                              >
                                {name ?? r.submitter_email}
                              </Typography>
                              {name && name !== r.submitter_email && (
                                <Typography
                                  sx={{ fontSize: "0.8rem" }}
                                  color="text.secondary"
                                  noWrap
                                >
                                  {r.submitter_email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>
                          {submitted ? (
                            <>
                              <Typography sx={{ fontSize: "0.95rem" }}>
                                {fmtDate(submitted)}
                              </Typography>
                              <Typography
                                sx={{ fontSize: "0.8rem" }}
                                color="text.secondary"
                              >
                                {submitted.toLocaleTimeString(i18n.language, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Typography>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: "0.95rem" }}>
                            {r.current_actor_role
                              ? t(`role.${r.current_actor_role}`)
                              : "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            aria-label={t("common.actions")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor({ anchor: e.currentTarget, item: r });
                            }}
                            sx={{
                              border: 1,
                              borderColor: "divider",
                              borderRadius: "10px",
                            }}
                          >
                            <MoreHorizOutlinedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Card>
      )}

      {/* Pagination — outside the table card: count left, controls right. */}
      {data && data.results.length > 0 && (
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

      {/* Row actions — all navigate to the detail page, where the
          server-provided `actions` list gates the real workflow buttons. */}
      <Menu
        anchorEl={menuFor?.anchor}
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
      >
        {menuActions.map((a) => (
          <MenuItem
            key={a.key}
            onClick={() => {
              const id = menuItem?.id;
              setMenuFor(null);
              if (id) navigate(`/requests/${id}`);
            }}
          >
            <ListItemIcon>{a.icon}</ListItemIcon>
            <ListItemText>{a.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
