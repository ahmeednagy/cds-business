import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
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
import { downloadFile, get } from "../../lib/api";
import { useNumberFormat } from "../../lib/format";
import { isRtlLanguage } from "../../i18n";
import type { ItemStatus, ReportResponse, ReportScope } from "../../types";

type ReportKey = "attendance" | "timesheets" | "requests" | "employees";

const ITEM_STATUSES: ItemStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "RETURNED",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];
const ATTENDANCE_STATUSES = ["PRESENT", "IN_PROGRESS"];
const PAGE_SIZE = 15;

interface Column {
  key: string;
  labelKey: string;
  render?: (row: Record<string, unknown>) => ReactNode;
  align?: "left" | "right" | "center";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}
function str(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Status cell: workflow statuses get the standard badge; attendance
 * statuses get their own label/severity. */
function StatusCell({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === "PRESENT" || status === "IN_PROGRESS") {
    const present = status === "PRESENT";
    return (
      <Chip
        size="small"
        variant="filled"
        label={t(`attendance.state.${status.toLowerCase().replace("_", "")}`, {
          defaultValue: status,
        })}
        sx={(theme) => ({
          height: 24,
          fontSize: "0.75rem",
          fontWeight: 600,
          ...(present
            ? {
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(47,125,79,0.22)"
                    : "rgba(47,125,79,0.10)",
                color: theme.palette.success.main,
              }
            : {
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(176,122,30,0.22)"
                    : "rgba(176,122,30,0.12)",
                color: theme.palette.warning.main,
              }),
        })}
      />
    );
  }
  return <StatusBadge status={status} />;
}

/* ---------- KPI card ---------- */

function KpiCard({
  icon,
  tint,
  bg,
  value,
  label,
  labelColor,
}: {
  icon: ReactNode;
  tint: string;
  bg: string;
  value: ReactNode;
  label: string;
  labelColor?: string;
}) {
  const { t } = useTranslation();
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
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 3.5 }}
      >
        <IconBadge icon={icon} tint={tint} size={56} />
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
            {t("reports.kpi.inSelectedPeriod")}
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
    <FormControl size="small" sx={{ flex: "1 1 170px", minWidth: 150 }}>
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

interface Filters {
  report: ReportKey;
  dateFrom: string;
  dateTo: string;
  employeeId: string;
  department: string;
  status: string;
  requestType: string;
}
const EMPTY_FILTERS: Filters = {
  report: "attendance",
  dateFrom: "",
  dateTo: "",
  employeeId: "",
  department: "",
  status: "",
  requestType: "",
};

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const nf = useNumberFormat();
  const navigate = useNavigate();
  const isRtl = isRtlLanguage(i18n.language);

  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportError, setExportError] = useState(false);
  const [menuFor, setMenuFor] = useState<{
    anchor: HTMLElement;
    row: Record<string, unknown>;
  } | null>(null);

  const { data: scope } = useQuery({
    queryKey: ["reports", "scope"],
    queryFn: () => get<ReportScope>("/api/reports/scope/"),
  });
  const canPickEmployee = Boolean(scope?.can_pick_employee);

  // Status options follow the report being configured in the filter card.
  const draftStatusChoices = useMemo(
    () =>
      draft.report === "attendance"
        ? ATTENDANCE_STATUSES
        : draft.report === "employees"
          ? []
          : ITEM_STATUSES,
    [draft.report],
  );

  // Everything the API/exports see comes from the *applied* filter state.
  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      lang: i18n.language.startsWith("ar") ? "ar" : "en",
    });
    const appliedStatusChoices =
      applied.report === "attendance"
        ? ATTENDANCE_STATUSES
        : applied.report === "employees"
          ? []
          : ITEM_STATUSES;
    if (applied.dateFrom) p.set("date_from", applied.dateFrom);
    if (applied.dateTo) p.set("date_to", applied.dateTo);
    if (applied.employeeId) p.set("employee", applied.employeeId);
    if (applied.department) p.set("department", applied.department);
    if (applied.status && appliedStatusChoices.includes(applied.status))
      p.set("status", applied.status);
    if (applied.requestType && applied.report === "requests")
      p.set("request_type", applied.requestType);
    return p;
  }, [page, applied, i18n.language]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", applied.report, params.toString()],
    queryFn: () =>
      get<ReportResponse>(`/api/reports/${applied.report}/?${params}`),
    placeholderData: (prev) => prev,
  });

  const fmtDate = (iso: unknown) =>
    iso ? new Date(str(iso)).toLocaleDateString(i18n.language) : "—";
  const fmtDateTime = (iso: unknown) =>
    iso
      ? new Date(str(iso)).toLocaleString(i18n.language, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const fmtTime = (iso: unknown) =>
    iso
      ? new Date(str(iso)).toLocaleTimeString(i18n.language, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const fmtHours = (v: unknown) => `${nf.format(num(v))} ${t("attendance.unit.h")}`;

  const initials = (name: string, email: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const base = parts.length ? parts : [email];
    return base
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("");
  };

  const employeeCell = (row: Record<string, unknown>) => {
    const name = str(row.employee_name);
    const email = str(row.employee_email);
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar
          sx={(theme) => ({
            width: 34,
            height: 34,
            fontSize: "0.8rem",
            fontWeight: 700,
            bgcolor:
              theme.palette.mode === "dark"
                ? alpha("#4A4D52", 0.45)
                : "#EDEFF2",
            color: "text.secondary",
          })}
        >
          {initials(name, email)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600 }} noWrap>
            {name || email || "—"}
          </Typography>
          {name && email && (
            <Typography
              sx={{ fontSize: "0.8rem" }}
              color="text.secondary"
              noWrap
            >
              {email}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const columns: Column[] = useMemo(() => {
    const emp: Column[] = [
      {
        key: "employee_name",
        labelKey: "reports.col.employee",
        render: employeeCell,
      },
      {
        key: "department",
        labelKey: "reports.col.department",
        render: (r) => str(r.department) || "—",
      },
    ];
    switch (applied.report) {
      case "attendance":
        return [
          ...emp,
          { key: "date", labelKey: "reports.col.date", render: (r) => fmtDate(r.date) },
          { key: "check_in", labelKey: "timesheets.checkIn", render: (r) => fmtTime(r.check_in) },
          { key: "check_out", labelKey: "timesheets.checkOut", render: (r) => fmtTime(r.check_out) },
          { key: "worked_hours", labelKey: "reports.col.worked", render: (r) => fmtHours(r.worked_hours), align: "right" },
          { key: "sessions", labelKey: "reports.col.sessions", render: (r) => nf.format(num(r.sessions)), align: "center" },
          { key: "status", labelKey: "common.status", render: (r) => <StatusCell status={str(r.status)} /> },
        ];
      case "timesheets":
        return [
          ...emp,
          { key: "business_week_start", labelKey: "reports.col.week", render: (r) => `${fmtDate(r.business_week_start)} – ${fmtDate(r.week_end)}` },
          { key: "logged_hours", labelKey: "reports.col.logged", render: (r) => fmtHours(r.logged_hours), align: "right" },
          { key: "status", labelKey: "common.status", render: (r) => <StatusCell status={str(r.status)} /> },
          { key: "submitted_at", labelKey: "reports.col.submitted", render: (r) => fmtDateTime(r.submitted_at) },
        ];
      case "requests":
        return [
          { key: "id", labelKey: "reports.col.id", render: (r) => `#${nf.format(num(r.id))}` },
          ...emp,
          { key: "request_type", labelKey: "requests.type", render: (r) => str(r.request_type) },
          { key: "created_at", labelKey: "requests.submitted", render: (r) => fmtDateTime(r.created_at) },
          { key: "status", labelKey: "common.status", render: (r) => <StatusCell status={str(r.status)} /> },
        ];
      case "employees":
        return [
          ...emp,
          { key: "attendance_days", labelKey: "reports.col.attendanceDays", render: (r) => nf.format(num(r.attendance_days)), align: "center" },
          { key: "worked_hours", labelKey: "reports.col.worked", render: (r) => fmtHours(r.worked_hours), align: "right" },
          { key: "logged_hours", labelKey: "reports.col.logged", render: (r) => fmtHours(r.logged_hours), align: "right" },
          { key: "requests_total", labelKey: "reports.col.requests", render: (r) => nf.format(num(r.requests_total)), align: "center" },
          { key: "requests_approved", labelKey: "reports.col.approved", render: (r) => nf.format(num(r.requests_approved)), align: "center" },
        ];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.report, i18n.language]);

  /** Four KPI cards per report — only metrics the summary actually returns. */
  const kpis = useMemo(() => {
    const s = (data?.summary ?? {}) as Record<string, unknown>;
    const group = (s.by_status_group ?? {}) as Record<string, number>;
    const byStatus = (s.by_status ?? {}) as Record<string, number>;
    const RED = "#E31E24";
    const GREEN = "#2F7D4F";
    const AMBER = "#B07A1E";
    const BLUE = "#2F6FED";
    const mk = (
      icon: ReactNode,
      tint: string,
      bg: string,
      value: ReactNode,
      label: string,
      labelColor?: string,
    ) => ({ icon, tint, bg, value, label, labelColor });
    switch (applied.report) {
      case "attendance":
        return [
          mk(<ScheduleOutlinedIcon />, RED, "#FADADD", fmtHours(s.total_worked_hours), t("reports.kpi.totalWorked")),
          mk(<EventAvailableOutlinedIcon />, GREEN, "#D8EDD9", nf.format(num(s.attendance_days)), t("reports.kpi.activeDays"), GREEN),
          mk(<PlayCircleOutlineOutlinedIcon />, AMBER, "#FDE8C8", nf.format(num(s.sessions)), t("reports.kpi.sessions"), AMBER),
          mk(<PersonOutlineOutlinedIcon />, BLUE, "#DDE8F5", nf.format(num(s.employees)), t("reports.kpi.employees"), BLUE),
        ];
      case "timesheets":
        return [
          mk(<AssignmentOutlinedIcon />, RED, "#FADADD", nf.format(num(s.timesheets)), t("reports.kpi.timesheets")),
          mk(<ScheduleOutlinedIcon />, BLUE, "#DDE8F5", fmtHours(s.total_logged_hours), t("reports.kpi.loggedHours"), BLUE),
          mk(<CheckCircleOutlineIcon />, GREEN, "#D8EDD9", nf.format(byStatus.APPROVED ?? 0), t("reports.kpi.approved"), GREEN),
          mk(<ScheduleOutlinedIcon />, AMBER, "#FDE8C8", nf.format(group.pending ?? 0), t("reports.kpi.pending"), AMBER),
        ];
      case "requests":
        return [
          mk(<AssignmentOutlinedIcon />, RED, "#FADADD", nf.format(num(s.total)), t("reports.kpi.totalRequests")),
          mk(<CheckCircleOutlineIcon />, GREEN, "#D8EDD9", nf.format(group.approved ?? 0), t("reports.kpi.approved"), GREEN),
          mk(<ScheduleOutlinedIcon />, AMBER, "#FDE8C8", nf.format(group.pending ?? 0), t("reports.kpi.pending"), AMBER),
          mk(<CancelOutlinedIcon />, BLUE, "#DDE8F5", nf.format(group.rejected ?? 0), t("reports.kpi.rejected"), BLUE),
        ];
      case "employees":
        return [
          mk(<PersonOutlineOutlinedIcon />, RED, "#FADADD", nf.format(num(s.employees)), t("reports.kpi.employees")),
          mk(<ScheduleOutlinedIcon />, GREEN, "#D8EDD9", fmtHours(s.total_worked_hours), t("reports.kpi.totalWorked"), GREEN),
          mk(<AssignmentOutlinedIcon />, AMBER, "#FDE8C8", fmtHours(s.total_logged_hours), t("reports.kpi.loggedHours"), AMBER),
          mk(<CheckCircleOutlineIcon />, BLUE, "#DDE8F5", nf.format(num(s.requests_total)), t("reports.kpi.requests"), BLUE),
        ];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, applied.report, i18n.language]);

  const doExport = async (fmt: "xlsx" | "pdf") => {
    setExporting(fmt);
    setExportError(false);
    try {
      const p = new URLSearchParams(params);
      p.delete("page");
      p.delete("page_size");
      p.set("fmt", fmt);
      const { blob, filename } = await downloadFile(
        `/api/reports/${applied.report}/export/?${p}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
  };
  const clearFilters = () => {
    setDraft((d) => ({ ...EMPTY_FILTERS, report: d.report }));
    setApplied((a) => ({ ...EMPTY_FILTERS, report: a.report }));
    setPage(1);
  };
  const setDraftReport = (key: ReportKey) =>
    setDraft((d) => ({ ...d, report: key, status: "", requestType: "" }));

  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const pageWindow = useMemo(() => {
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    if (pages.length <= 5) return pages;
    const start = Math.min(Math.max(1, page - 2), pageCount - 4);
    return pages.slice(start - 1, start + 4);
  }, [pageCount, page]);

  const PrevIcon = isRtl ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  // A real detail route exists for request/timesheet rows; attendance-day and
  // employee-summary rows have no detail page, so the control is disabled.
  const rowDetailPath = (row: Record<string, unknown>) =>
    applied.report === "requests" || applied.report === "timesheets"
      ? `/${applied.report === "requests" ? "requests" : "timesheets"}/${num(row.id)}`
      : null;

  const menuRow = menuFor?.row;
  const menuPath = menuRow ? rowDetailPath(menuRow) : null;

  const exportBtnSx = {
    height: 50,
    borderRadius: "10px",
    px: 2.5,
    fontSize: "0.95rem",
    fontWeight: 600,
  } as const;

  return (
    <>
      {/* Page heading — title + subtitle left, real export buttons right. */}
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
            {t("reports.title")}
          </Typography>
          <Typography sx={{ fontSize: "0.95rem", mt: 0.25 }} color="text.secondary">
            {t("reports.subtitle")}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            disabled={exporting !== null}
            onClick={() => void doExport("xlsx")}
            sx={exportBtnSx}
          >
            {exporting === "xlsx" ? t("common.loading") : t("reports.exportXlsx")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfOutlinedIcon />}
            disabled={exporting !== null}
            onClick={() => void doExport("pdf")}
            sx={exportBtnSx}
          >
            {exporting === "pdf" ? t("common.loading") : t("reports.exportPdf")}
          </Button>
        </Box>
      </Box>

      {/* Filter card — draft state applies on Apply; Clear resets (keeps report). */}
      <Card sx={{ borderRadius: "16px", px: 3, py: 2.5, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            gap: 2.5,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <FilterField label={t("reports.reportType")}>
            <Select
              value={draft.report}
              onChange={(e) => setDraftReport(e.target.value as ReportKey)}
              sx={controlSx}
              inputProps={{ "aria-label": t("reports.reportType") }}
              startAdornment={
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  <AssessmentOutlinedIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              }
            >
              {(["attendance", "timesheets", "requests", "employees"] as const).map(
                (k) => (
                  <MenuItem key={k} value={k}>
                    {t(`reports.tab.${k}`)}
                  </MenuItem>
                ),
              )}
            </Select>
          </FilterField>

          <FilterField label={t("reports.filters.from")}>
            <TextField
              size="small"
              type="date"
              value={draft.dateFrom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, dateFrom: e.target.value }))
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  ...controlSx,
                  "& input::-webkit-calendar-picker-indicator": {
                    opacity: 0.55,
                  },
                },
              }}
              inputProps={{ "aria-label": t("reports.filters.from") }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthOutlinedIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  </InputAdornment>
                ),
              }}
            />
          </FilterField>

          <FilterField label={t("reports.filters.to")}>
            <TextField
              size="small"
              type="date"
              value={draft.dateTo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, dateTo: e.target.value }))
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  ...controlSx,
                  "& input::-webkit-calendar-picker-indicator": {
                    opacity: 0.55,
                  },
                },
              }}
              inputProps={{ "aria-label": t("reports.filters.to") }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthOutlinedIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  </InputAdornment>
                ),
              }}
            />
          </FilterField>

          {canPickEmployee && (
            <FilterField label={t("reports.filters.employee")}>
              <Select
                value={draft.employeeId}
                displayEmpty
                onChange={(e) =>
                  setDraft((d) => ({ ...d, employeeId: e.target.value }))
                }
                sx={controlSx}
                inputProps={{ "aria-label": t("reports.filters.employee") }}
                startAdornment={
                  <InputAdornment position="start" sx={{ ml: 0.5 }}>
                    <PersonOutlineOutlinedIcon
                      fontSize="small"
                      sx={{ color: "text.secondary" }}
                    />
                  </InputAdornment>
                }
              >
                <MenuItem value="">{t("reports.filters.allEmployees")}</MenuItem>
                {(scope?.employees ?? []).map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>
                    {e.name || e.email}
                  </MenuItem>
                ))}
              </Select>
            </FilterField>
          )}

          {(scope?.departments?.length ?? 0) > 0 && (
            <FilterField label={t("reports.filters.department")}>
              <Select
                value={draft.department}
                displayEmpty
                onChange={(e) =>
                  setDraft((d) => ({ ...d, department: e.target.value }))
                }
                sx={controlSx}
                inputProps={{ "aria-label": t("reports.filters.department") }}
              >
                <MenuItem value="">
                  {t("reports.filters.allDepartments")}
                </MenuItem>
                {scope!.departments.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FilterField>
          )}

          {draftStatusChoices.length > 0 && (
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
                <MenuItem value="">
                  {t("reports.filters.allStatuses")}
                </MenuItem>
                {draftStatusChoices.map((s) => (
                  <MenuItem key={s} value={s}>
                    {draft.report === "attendance"
                      ? t(`attendance.state.${s.toLowerCase().replace("_", "")}`, {
                          defaultValue: s,
                        })
                      : t(`status.${s}`)}
                  </MenuItem>
                ))}
              </Select>
            </FilterField>
          )}

          {draft.report === "requests" &&
            (scope?.request_types?.length ?? 0) > 0 && (
              <FilterField label={t("requests.type")}>
                <Select
                  value={draft.requestType}
                  displayEmpty
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, requestType: e.target.value }))
                  }
                  sx={controlSx}
                  inputProps={{ "aria-label": t("requests.type") }}
                >
                  <MenuItem value="">{t("requests.allTypes")}</MenuItem>
                  {scope!.request_types.map((rt) => (
                    <MenuItem key={rt.id} value={String(rt.id)}>
                      {rt.name}
                    </MenuItem>
                  ))}
                </Select>
              </FilterField>
            )}

          <Button
            variant="outlined"
            onClick={clearFilters}
            sx={{ height: 50, borderRadius: "10px", px: 3 }}
          >
            {t("reports.filters.clear")}
          </Button>
          <Button
            variant="contained"
            startIcon={<FilterAltOutlinedIcon />}
            onClick={applyFilters}
            sx={{ height: 50, borderRadius: "10px", px: 3 }}
          >
            {t("reports.filters.apply")}
          </Button>
        </Box>
      </Card>

      {/* KPI cards — real metrics of the applied report + filters. */}
      {isLoading && !data ? (
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
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </Box>
      )}

      {error && <ErrorAlert error={error} />}
      {isLoading && !data && <TableSkeleton rows={6} />}

      {data && (
        <Card sx={{ borderRadius: "16px" }}>
          {(data.results ?? []).length === 0 ? (
            <EmptyState
              message={t("reports.empty")}
              icon={
                <AssessmentOutlinedIcon
                  sx={{ fontSize: 40, color: "text.disabled" }}
                />
              }
            />
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table aria-label={t(`reports.tab.${applied.report}`)}>
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
                    {columns.map((c) => (
                      <TableCell key={c.key} align={c.align ?? "left"}>
                        {t(c.labelKey)}
                      </TableCell>
                    ))}
                    <TableCell>{t("common.actions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.results.map((row, i) => {
                    const detail = rowDetailPath(row);
                    return (
                      <TableRow
                        key={i}
                        hover
                        sx={{
                          "& td": {
                            px: 3,
                            py: 1.75,
                            fontSize: "0.95rem",
                            borderColor: "divider",
                          },
                          "&:last-child td": { borderBottom: "none" },
                        }}
                      >
                        {columns.map((c) => (
                          <TableCell key={c.key} align={c.align ?? "left"}>
                            {c.render ? c.render(row) : str(row[c.key]) || "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          <IconButton
                            size="small"
                            aria-label={t("common.actions")}
                            disabled={!detail}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuFor({ anchor: e.currentTarget, row });
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

      {/* Row action — View navigates to the item's existing detail page. */}
      <Menu
        anchorEl={menuFor?.anchor}
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuFor(null);
            if (menuPath) navigate(menuPath);
          }}
        >
          <ListItemIcon>
            <VisibilityOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("reports.action.view")}</ListItemText>
        </MenuItem>
      </Menu>

      <Snackbar
        open={exportError}
        autoHideDuration={4000}
        onClose={() => setExportError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setExportError(false)}>
          {t("reports.exportFailed")}
        </Alert>
      </Snackbar>
    </>
  );
}
