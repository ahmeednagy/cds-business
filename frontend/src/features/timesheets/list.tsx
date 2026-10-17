import { useMemo, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
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
import { businessWeek, mondayOf } from "../../lib/dates";
import { useFormatDuration, useNumberFormat } from "../../lib/format";
import { isRtlLanguage } from "../../i18n";
import type { Page, ReportScope, Timesheet } from "../../types";

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

/** Week-granular range presets resolved to Monday week_start keys
 * (week_from/week_to filters). The display span is the Sun–Sat business
 * weeks the keys cover. */
function resolveRange(preset: RangePreset): {
  from?: string;
  to?: string;
  sunday?: Date;
  saturday?: Date;
} {
  if (!preset) return {};
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d;
  };
  let d1: Date;
  let d2: Date;
  switch (preset) {
    case "this_week":
      d1 = d2 = today;
      break;
    case "last_week":
      d1 = d2 = day(-7);
      break;
    case "last_4_weeks":
      d1 = day(-21);
      d2 = today;
      break;
    case "this_month":
      d1 = new Date(today.getFullYear(), today.getMonth(), 1);
      d2 = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "last_month":
      d1 = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      d2 = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
  }
  const from = mondayOf(d1);
  const to = mondayOf(d2);
  return {
    from,
    to,
    sunday: businessWeek(from).start,
    saturday: businessWeek(to).end,
  };
}

interface Filters {
  status: string;
  employee: string;
  range: RangePreset;
  pendingReview: boolean;
}
const EMPTY_FILTERS: Filters = {
  status: "",
  employee: "",
  range: "",
  pendingReview: false,
};

/** Select arrow override — renders nothing so a locked (disabled) Employee
 * field shows no affordance, per the design spec. */
const NoChevron = () => null;

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
        borderRadius: "16px",
        height: "100%",
        bgcolor: theme.palette.mode === "dark" ? alpha(tint, 0.14) : bg,
        borderColor: alpha(tint, theme.palette.mode === "dark" ? 0.35 : 0.25),
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 3 }}>
        <IconBadge icon={icon} tint={tint} size={52} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="p"
            fontWeight={800}
            sx={{ fontSize: "1.6rem", lineHeight: 1.2 }}
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
  height: 44,
  borderRadius: "10px",
  "& .MuiSelect-select": { display: "flex", alignItems: "center" },
} as const;

export default function TimesheetListPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const nf = useNumberFormat();
  const fmtMin = useFormatDuration();
  const isRtl = isRtlLanguage(i18n.language);

  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [menuFor, setMenuFor] = useState<{
    anchor: HTMLElement;
    ts: Timesheet;
  } | null>(null);

  const { data: scope } = useQuery({
    queryKey: ["reports", "scope"],
    queryFn: () => get<ReportScope>("/api/reports/scope/"),
  });
  const canPickEmployee = Boolean(scope?.can_pick_employee);
  const canReview = user?.role === "MANAGER" || user?.role === "HR";
  const employeeName = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of scope?.employees ?? []) m.set(e.id, e.name || e.email);
    return m;
  }, [scope]);

  // Employees only ever see their own timesheets, so the Employee filter is
  // still rendered (matching the reference) but locked to the signed-in user —
  // derived rather than stored, so it can never be widened client-side.
  const selfId = user ? String(user.id) : "";
  const selfName = useMemo(() => {
    const p = user?.profile;
    const n = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
    return n || user?.email || "";
  }, [user]);
  const appliedEmployee = canPickEmployee ? applied.employee : selfId;
  const draftEmployee = canPickEmployee ? draft.employee : selfId;

  const rangeParams = useMemo(() => resolveRange(applied.range), [applied.range]);
  const draftRange = useMemo(() => resolveRange(draft.range), [draft.range]);

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    if (appliedEmployee) p.set("submitter", appliedEmployee);
    if (rangeParams.from) p.set("week_from", rangeParams.from);
    if (rangeParams.to) p.set("week_to", rangeParams.to);
    if (applied.pendingReview) p.set("pending_review", "true");
    return p;
  }, [appliedEmployee, rangeParams, applied]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams(baseParams);
    p.set("page", String(page));
    if (applied.status) p.set("status", applied.status);
    if (ordering) p.set("ordering", ordering);
    return p.toString();
  }, [baseParams, page, applied.status, ordering]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["timesheets", queryString],
    queryFn: () => get<Page<Timesheet>>(`/api/timesheets/?${queryString}`),
  });

  // Summary cards = the status breakdown of the filtered set — they apply
  // every filter EXCEPT status itself (the cards are how you see the
  // distribution). Count-only queries (page_size=1) keep them cheap.
  const countKey = useMemo(
    () => [appliedEmployee, applied.range, applied.pendingReview],
    [appliedEmployee, applied],
  );
  const countQueries = useQueries({
    queries: ["", "APPROVED", "PENDING", "IN_REVIEW", "REJECTED"].map((s) => ({
      queryKey: ["timesheets", "count", s, ...countKey],
      queryFn: () => {
        const p = new URLSearchParams(baseParams);
        p.set("page", "1");
        p.set("page_size", "1");
        if (s) p.set("status", s);
        return get<Page<Timesheet>>(`/api/timesheets/?${p}`);
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
    applied.status || applied.employee || applied.range || applied.pendingReview,
  );

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
  };
  const clearFilters = () => {
    // For employees the Employee field is derived (self) — clearing other
    // filters is enough.
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

  const menuTs = menuFor?.ts;
  const menuActions = useMemo(() => {
    if (!menuTs || !user) return [];
    const items: { key: string; icon: ReactNode; label: string }[] = [
      {
        key: "view",
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        label: t("timesheets.action.view"),
      },
    ];
    const actionable = menuTs.status === "PENDING" || menuTs.status === "IN_REVIEW";
    if (actionable && menuTs.current_actor_role === user.role) {
      items.push({
        key: "review",
        icon: <RateReviewOutlinedIcon fontSize="small" />,
        label: t("timesheets.action.review"),
      });
    }
    if (menuTs.submitter === user.id && menuTs.status === "RETURNED") {
      items.push({
        key: "resubmit",
        icon: <ReplayOutlinedIcon fontSize="small" />,
        label: t("timesheets.action.resubmit"),
      });
    }
    return items;
  }, [menuTs, user, t]);

  return (
    <>
      {/* Page heading — large bold title + subtitle, New timesheet right. */}
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
            {t("timesheets.title")}
          </Typography>
          <Typography sx={{ fontSize: "0.95rem", mt: 0.25 }} color="text.secondary">
            {t("timesheets.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => navigate("/timesheets/new")}
          sx={{
            height: 52,
            borderRadius: "12px",
            px: 3,
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          {t("timesheets.new")}
        </Button>
      </Box>

      {/* Filter panel — draft state applies on Apply; Clear resets. */}
      <Card sx={{ borderRadius: "16px", px: 3, py: 2, mb: 3 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            alignItems: "end",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              // Reference proportions: Status ~20%, Date range ~27%,
              // Employee ~27%, then compact Clear/Apply flush right.
              lg: "minmax(0,20fr) minmax(0,27fr) minmax(0,27fr) auto auto",
            },
          }}
        >
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
              <MenuItem value="">{t("timesheets.allStatuses")}</MenuItem>
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`status.${s}`)}
                </MenuItem>
              ))}
            </Select>
          </FilterField>

          <FilterField label={t("timesheets.filters.dateRange")}>
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
              inputProps={{ "aria-label": t("timesheets.filters.dateRange") }}
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
                    {fmtRangeSpan(draftRange.sunday!, draftRange.saturday!)}
                  </Typography>
                ) : (
                  <Typography component="span" sx={{ fontSize: "0.95rem" }}>
                    {t("timesheets.filters.allTime")}
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
                        {t(`timesheets.filters.${RANGE_LABEL_KEY[p]}`)}
                      </Typography>
                      {r.sunday && (
                        <Typography
                          sx={{ fontSize: "0.8rem" }}
                          color="text.secondary"
                        >
                          {fmtRangeSpan(r.sunday, r.saturday!)}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FilterField>

          {/* Employee — dropdown of the caller's authorized scope
              (manager: self + reports, HR: permitted scope). For employees it
              is locked to self: the field stays visible per the design but is
              read-only, so RBAC is preserved. */}
          <FilterField label={t("timesheets.employee")}>
            <Select
              value={draftEmployee}
              displayEmpty
              disabled={!canPickEmployee}
              onChange={(e) =>
                setDraft((d) => ({ ...d, employee: e.target.value }))
              }
              IconComponent={canPickEmployee ? undefined : NoChevron}
              sx={(theme) => ({
                ...controlSx,
                // Locked state stays readable and matches the other controls —
                // not the washed-out MUI disabled look.
                "& .MuiSelect-select.Mui-disabled": {
                  WebkitTextFillColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                },
                "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
                  borderColor: theme.palette.divider,
                },
                "&.Mui-disabled": { bgcolor: theme.palette.action.hover },
              })}
              inputProps={{ "aria-label": t("timesheets.employee") }}
              startAdornment={
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  <PersonOutlineOutlinedIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              }
              renderValue={(v) =>
                v ? (
                  <Typography component="span" sx={{ fontSize: "0.95rem" }} noWrap>
                    {employeeName.get(Number(v)) ??
                      (v === selfId ? selfName : v)}
                  </Typography>
                ) : (
                  <Typography component="span" sx={{ fontSize: "0.95rem" }}>
                    {t("timesheets.filters.allEmployees")}
                  </Typography>
                )
              }
            >
              {canPickEmployee && (
                <MenuItem value="">
                  {t("timesheets.filters.allEmployees")}
                </MenuItem>
              )}
              {(scope?.employees ?? []).map((e) => (
                <MenuItem key={e.id} value={String(e.id)}>
                  {e.name || e.email}
                </MenuItem>
              ))}
              {/* Fallback self option while the scope is still loading. */}
              {(scope?.employees ?? []).length === 0 && selfId && (
                <MenuItem value={selfId}>{selfName}</MenuItem>
              )}
            </Select>
          </FilterField>

          <Button
            variant="outlined"
            onClick={clearFilters}
            sx={{ height: 44, borderRadius: "10px", px: 3, justifySelf: "end" }}
          >
            {t("timesheets.filters.clear")}
          </Button>
          <Button
            variant="contained"
            startIcon={<FilterAltOutlinedIcon />}
            onClick={applyFilters}
            sx={{ height: 44, borderRadius: "10px", px: 3, justifySelf: "end" }}
          >
            {t("timesheets.filters.apply")}
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
                {t("timesheets.awaitingMyReview")}
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
            label={t("timesheets.summary.total")}
            caption={t("timesheets.summary.inSelectedPeriod")}
          />
          <StatCard
            icon={<CheckCircleOutlineIcon />}
            tint="#2F7D4F"
            bg="#D8EDD9"
            value={nf.format(approvedCount)}
            label={t("timesheets.summary.approved")}
            labelColor="#2F7D4F"
            caption={t("timesheets.summary.ofTotal", { pct: pct(approvedCount) })}
          />
          <StatCard
            icon={<ScheduleOutlinedIcon />}
            tint="#B07A1E"
            bg="#FDE8C8"
            value={nf.format(pendingCount)}
            label={t("timesheets.summary.pending")}
            labelColor="#B07A1E"
            caption={t("timesheets.summary.ofTotal", { pct: pct(pendingCount) })}
          />
          <StatCard
            icon={<CancelOutlinedIcon />}
            tint="#2F6FED"
            bg="#DDE8F5"
            value={nf.format(rejectedCount)}
            label={t("timesheets.summary.rejected")}
            labelColor="#2F6FED"
            caption={t("timesheets.summary.ofTotal", { pct: pct(rejectedCount) })}
          />
        </Box>
      )}

      {error && <ErrorAlert error={error} sx={{ mb: 3 }} />}
      {isLoading && <TableSkeleton />}

      {data && (
        <Card sx={{ borderRadius: "16px" }}>
          {data.results.length === 0 ? (
            <EmptyState
              message={
                hasFilters
                  ? t("timesheets.noFilterResults")
                  : t("timesheets.empty")
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={clearFilters}
                  >
                    {t("timesheets.clearFilters")}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate("/timesheets/new")}
                  >
                    {t("timesheets.new")}
                  </Button>
                )
              }
            />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
                <Table aria-label={t("timesheets.title")}>
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
                          ["week_start", t("timesheets.weekStartingSunday")],
                          [null, t("timesheets.employee")],
                          [null, t("timesheets.hours")],
                          ["status", t("common.status")],
                          ["submitted_at", t("timesheets.submittedOn")],
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
                    {data.results.map((ts) => {
                      const biz = businessWeek(ts.week_start);
                      const name = employeeName.get(ts.submitter);
                      const submitted = ts.submitted_at
                        ? new Date(ts.submitted_at)
                        : null;
                      return (
                        <TableRow
                          key={ts.id}
                          hover
                          onClick={() => navigate(`/timesheets/${ts.id}`)}
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
                            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
                              {fmtDate(biz.start)}
                            </Typography>
                            <Typography
                              sx={{ fontSize: "0.8rem" }}
                              color="text.secondary"
                            >
                              {fmtRangeSpan(biz.start, biz.end)}
                            </Typography>
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
                                {(name ?? ts.submitter_email)
                                  .charAt(0)
                                  .toUpperCase()}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{ fontSize: "0.95rem", fontWeight: 600 }}
                                  noWrap
                                >
                                  {name ?? ts.submitter_email}
                                </Typography>
                                {name && name !== ts.submitter_email && (
                                  <Typography
                                    sx={{ fontSize: "0.8rem" }}
                                    color="text.secondary"
                                    noWrap
                                  >
                                    {ts.submitter_email}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600 }}>
                              {fmtMin(ts.total_hours * 60)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ts.status} />
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
                            <IconButton
                              size="small"
                              aria-label={t("common.actions")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuFor({ anchor: e.currentTarget, ts });
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
              if (menuTs) navigate(`/timesheets/${menuTs.id}`);
              setMenuFor(null);
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
