import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  alpha,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  IconButton,
  List,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import BedtimeOutlinedIcon from "@mui/icons-material/BedtimeOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { AttendanceControl } from "../components/AttendanceControl";
import { BarChart, LineChart } from "../components/charts";
import {
  AppLink,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  IconBadge,
  StatusBadge,
} from "../components/ui";
import { get } from "../lib/api";
import {
  REQUIRED_DAILY_HOURS,
  REQUIRED_WEEKLY_HOURS,
  workedSecondsToday,
} from "../lib/attendance";
import { businessWeek, localISO, mondayOf, relativeTime } from "../lib/dates";
import { useFormatDuration, useNumberFormat } from "../lib/format";
import { useAuth } from "../lib/auth";
import { isRtlLanguage } from "../i18n";
import type {
  AppNotification,
  AttendanceSession,
  AttendanceToday,
  AttendanceWeek,
  Dashboard,
  ItemStatus,
  Page,
  RequestItem,
  RequestType,
  Timesheet,
} from "../types";

const REQUEST_STATUSES: ItemStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "RETURNED",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

function itemPath(n: AppNotification): string | null {
  if (n.item_type === "request") return `/requests/${n.item_id}`;
  if (n.item_type === "timesheet") return `/timesheets/${n.item_id}`;
  return null;
}

/* ---------- KPI card — reference geometry: 64px icon, label + chevron row,
 * ~30px value, tinted caption, pastel bg, ~152px tall. ---------- */

interface KpiCardProps {
  icon: ReactNode;
  /** Solid accent — icon + attendance text tint; card bg/border render it pastel. */
  tint: string;
  /** Pastel card background — strong enough to read as the reference tint. */
  bg: string;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  /** Tint the caption line (reference: colored trend/status text). */
  captionTint?: string;
  to?: string;
  /** When set, label/value/caption adopt the tint (attendance card). */
  accentText?: boolean;
}

function KpiCard({
  icon,
  tint,
  bg,
  label,
  value,
  caption,
  captionTint,
  to,
  accentText,
}: KpiCardProps) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isXl = useMediaQuery((t: Theme) => t.breakpoints.up("xl"));
  const EndIcon = i18n.dir() === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
  const body = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { lg: 1, xl: 2.5 },
        px: { lg: 1.5, xl: 3 },
        py: 2.5,
        height: "100%",
      }}
    >
      <IconBadge icon={icon} tint={tint} size={isXl ? 56 : 44} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography
            fontWeight={600}
            noWrap
            sx={{
              lineHeight: 1.35,
              fontSize: { lg: "0.8rem", xl: "0.95rem" },
              color: accentText ? tint : "text.primary",
            }}
          >
            {label}
          </Typography>
          {to ? (
            <EndIcon
              sx={{
                fontSize: 22,
                color: "text.disabled",
                flexShrink: 0,
                display: { lg: "none", xl: "inline" },
              }}
            />
          ) : null}
        </Box>
        <Typography
          component="p"
          fontWeight={800}
          sx={{
            fontSize: { xs: "1.9rem", lg: "1.5rem", xl: "1.8rem" },
            lineHeight: 1.25,
            mt: 0.5,
            color: accentText ? tint : "text.primary",
          }}
          noWrap
        >
          {value}
        </Typography>
        {caption && (
          <Typography
            display="block"
            noWrap
            sx={{
              mt: 0.75,
              fontSize: { lg: "0.8rem", xl: "0.95rem" },
              fontWeight: 500,
              color: captionTint ?? (accentText ? tint : "text.secondary"),
            }}
          >
            {caption}
          </Typography>
        )}
      </Box>
    </Box>
  );
  return (
    <Card
      sx={(theme) => ({
        height: "100%",
        borderRadius: "16px",
        bgcolor: theme.palette.mode === "dark" ? alpha(tint, 0.16) : bg,
        borderColor: alpha(tint, theme.palette.mode === "dark" ? 0.35 : 0.25),
        transition: "border-color 150ms ease, box-shadow 150ms ease",
        ...(to
          ? {
              "&:hover": {
                borderColor: alpha(tint, 0.5),
                boxShadow: theme.shadows[2],
              },
            }
          : {}),
      })}
    >
      {to ? (
        <CardActionArea
          onClick={() => navigate(to)}
          sx={{ height: "100%", alignItems: "stretch" }}
        >
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

/* ---------- Reference card shell: ~28px padding, 22px title + info icon,
 * subtitle under title, actions top-right. ---------- */

function PanelCard({
  title,
  subtitle,
  actions,
  children,
  contentSx,
  sx,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentSx?: object;
  sx?: object;
}) {
  return (
    <Card sx={{ borderRadius: "16px", height: "100%", ...sx }}>
      <Box sx={{ px: 3.5, pt: 3, pb: 2.5, height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title}
            {subtitle ? (
              <Typography
                sx={{
                  display: "block",
                  mt: 0.5,
                  fontSize: "0.95rem",
                  color: "text.secondary",
                }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {actions}
        </Box>
        <Box sx={{ mt: 1.5, ...contentSx }}>{children}</Box>
      </Box>
    </Card>
  );
}

/** Section header: tinted icon circle + ~19px bold title (bottom cards). */
function PanelTitle({
  icon,
  tint,
  text,
}: {
  icon: ReactNode;
  tint: string;
  text: string;
}) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}
    >
      <IconBadge icon={icon} tint={tint} size={34} />
      <Typography
        component="span"
        sx={{ fontSize: "1.2rem", fontWeight: 700, lineHeight: 1.3 }}
      >
        {text}
      </Typography>
    </Box>
  );
}

/* ---------- Chart heading + info icon ---------- */

function ChartTitle({ text, hint }: { text: string; hint: string }) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      <Typography
        component="span"
        sx={{ fontSize: "1.3rem", fontWeight: 700, lineHeight: 1.3 }}
      >
        {text}
      </Typography>
      <Tooltip title={hint} arrow>
        <InfoOutlinedIcon
          sx={{ fontSize: 19, color: "text.secondary", cursor: "help" }}
        />
      </Tooltip>
    </Box>
  );
}

/* ---------- Muted metric tile (Worked Duration / Remaining) ---------- */

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        flex: 1,
        minWidth: 0,
        px: 2.5,
        py: 2,
        borderRadius: "12px",
        bgcolor:
          theme.palette.mode === "dark" ? theme.palette.action.hover : "#F2F5F9",
      })}
    >
      <Typography
        sx={{ fontSize: "0.95rem", color: "text.secondary" }}
        display="block"
      >
        {label}
      </Typography>
      <Typography
        component="p"
        fontWeight={800}
        sx={{ fontSize: "1.55rem", lineHeight: 1.3, mt: 0.25 }}
        noWrap
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Reference "View all / View details" red header link. */
function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <AppLink to={to}>
      <Typography
        component="span"
        sx={{ fontSize: "0.95rem", fontWeight: 600, color: "primary.main" }}
      >
        {children}
      </Typography>
    </AppLink>
  );
}

/* ---------- Attendance timeline endpoint: circle → stub → track dot ---------- */

function TimelineStop({
  circle,
  label,
  time,
  tint,
}: {
  circle: ReactNode;
  label: string;
  time: string;
  tint: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        minWidth: 96,
      }}
    >
      {circle}
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 2,
          height: 14,
          bgcolor: theme.palette.divider,
        })}
      />
      <Box
        aria-hidden
        sx={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          border: `2.5px solid ${tint}`,
          bgcolor: "background.paper",
          mb: 1,
        }}
      />
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: tint }}>
        {time}
      </Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isRtl = isRtlLanguage(i18n.language);
  const nf = useNumberFormat();
  const fmtDuration = useFormatDuration();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<Dashboard>("/api/dashboard/"),
  });

  // Current Mon-keyed business week (Sun–Sat) — used for the timesheet card
  // and the "this week" request range.
  const monday = mondayOf(new Date());
  const curBiz = businessWeek(monday);
  const curBizStartIso = localISO(curBiz.start);

  const { data: counts } = useQuery({
    queryKey: ["request-status-counts", curBizStartIso],
    queryFn: async () => {
      const results = await Promise.all(
        REQUEST_STATUSES.map((s) =>
          Promise.all([
            get<Page<RequestItem>>(`/api/requests/?status=${s}&page_size=1`),
            get<Page<RequestItem>>(
              `/api/requests/?status=${s}&date_from=${curBizStartIso}&page_size=1`,
            ),
          ]),
        ),
      );
      return {
        all: Object.fromEntries(
          REQUEST_STATUSES.map((s, i) => [s, results[i][0].count]),
        ) as Record<ItemStatus, number>,
        week: Object.fromEntries(
          REQUEST_STATUSES.map((s, i) => [s, results[i][1].count]),
        ) as Record<ItemStatus, number>,
      };
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => get<AttendanceToday>("/api/attendance/today/"),
    refetchInterval: 60_000,
  });

  // Tick while checked in so worked-hours reflects live elapsed time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!attendance?.active) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [attendance?.active]);

  // Hours chart range — the "This Week" pill is a real selector that can
  // show the current or the previous Sun–Sat business week.
  const [weekOffset, setWeekOffset] = useState(0);
  const [hoursAnchor, setHoursAnchor] = useState<HTMLElement | null>(null);
  const [typeRange, setTypeRange] = useState<"all" | "week">("all");
  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);

  const chartMonday = useMemo(() => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() - 7 * weekOffset);
    return localISO(d);
  }, [monday, weekOffset]);
  const chartPrevMonday = useMemo(() => {
    const d = new Date(`${chartMonday}T00:00:00`);
    d.setDate(d.getDate() - 7);
    return localISO(d);
  }, [chartMonday]);
  const biz = businessWeek(chartMonday);

  const { data: weekPrev } = useQuery({
    queryKey: ["attendance", "week", chartPrevMonday],
    queryFn: () =>
      get<AttendanceWeek>(`/api/attendance/week/?start=${chartPrevMonday}`),
  });
  const { data: weekCurr } = useQuery({
    queryKey: ["attendance", "week", chartMonday],
    queryFn: () => get<AttendanceWeek>(`/api/attendance/week/?start=${chartMonday}`),
  });

  const { data: weekSheetPage } = useQuery({
    queryKey: ["timesheets", "current-week", monday],
    queryFn: () =>
      get<Page<Timesheet>>(
        `/api/timesheets/?week_from=${monday}&week_to=${monday}&page_size=25`,
      ),
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () =>
      get<Page<AppNotification>>("/api/notifications/?page_size=5"),
  });

  const { data: typeCounts } = useQuery({
    queryKey: ["request-type-counts", typeRange, curBizStartIso],
    queryFn: async () => {
      const types = await get<Page<RequestType>>(
        "/api/request-types/?page_size=20",
      );
      const rangeParam =
        typeRange === "week" ? `&date_from=${curBizStartIso}` : "";
      const results = await Promise.all(
        types.results.map((rt) =>
          get<Page<RequestItem>>(
            `/api/requests/?request_type=${rt.id}${rangeParam}&page_size=1`,
          ),
        ),
      );
      return types.results
        .map((rt, i) => ({ label: rt.name, value: results[i].count }))
        .sort((a, b) => b.value - a.value);
    },
  });

  // Own sessions only — the attendance scope for managers/HR includes their
  // teams; the dashboard charts the signed-in user's hours.
  const ownWeekSessions = useMemo(() => {
    const all = [...(weekPrev?.results ?? []), ...(weekCurr?.results ?? [])];
    return all.filter((s) => s.submitter === user?.id);
  }, [weekPrev, weekCurr, user?.id]);

  // Daily worked-hours buckets for the selected Sun–Sat business week.
  const bizDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(biz.start);
      d.setDate(d.getDate() + i);
      return localISO(d);
    });
  }, [biz.start]);

  const hourSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of ownWeekSessions) {
      const secs =
        s.worked_seconds ??
        Math.max(
          0,
          ((s.check_out_at ? new Date(s.check_out_at) : now).getTime() -
            new Date(s.check_in_at).getTime()) /
            1000,
        );
      byDate.set(s.work_date, (byDate.get(s.work_date) ?? 0) + secs);
    }
    const fmtDay = new Intl.DateTimeFormat(i18n.language, {
      weekday: "short",
    });
    return bizDays.map((iso) => ({
      label: fmtDay.format(new Date(`${iso}T00:00:00`)),
      value: Math.round(((byDate.get(iso) ?? 0) / 3600) * 10) / 10,
    }));
  }, [ownWeekSessions, bizDays, now, i18n.language]);

  if (isLoading) return <CardSkeleton cards={5} />;
  if (error) return <ErrorAlert error={error} />;
  if (!data) return null;

  const name =
    [user?.profile?.first_name].filter(Boolean).join(" ") || user?.email || "";

  // Local-time greeting: 05–11 morning, 12–16 afternoon, 17–04 evening.
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
        ? "afternoon"
        : "evening";

  const workedMin = Math.floor(workedSecondsToday(attendance, now) / 60);
  const requiredMin = REQUIRED_DAILY_HOURS * 60;
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const sessions: AttendanceSession[] = attendance?.sessions ?? [];
  const firstCheckIn = [...sessions]
    .filter((s) => s.check_in_at)
    .sort((a, b) => a.check_in_at.localeCompare(b.check_in_at))
    .at(0)?.check_in_at;
  const lastCheckOut = [...sessions]
    .filter((s) => s.check_out_at)
    .sort((a, b) => b.check_out_at!.localeCompare(a.check_out_at!))
    .at(0)?.check_out_at;
  const attendanceState = attendance?.active
    ? t("attendance.state.checkedIn", { time: fmtTime(attendance.active.check_in_at) })
    : lastCheckOut
      ? t("attendance.state.checkedOut", { time: fmtTime(lastCheckOut) })
      : t("attendance.state.notCheckedIn");

  const fmtFullDay = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const fmtClock = new Intl.DateTimeFormat(i18n.language, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const kpiCards: {
    status: ItemStatus;
    label: string;
    tint: string;
    bg: string;
    icon: ReactNode;
    caption: string | null;
    captionTint: string;
  }[] = [
    {
      status: "PENDING",
      label: t("dashboard.pendingRequests"),
      tint: "#D9554C",
      bg: "#FCEBE8",
      icon: <DescriptionOutlinedIcon />,
      caption:
        counts != null
          ? t("dashboard.kpi.inReview", {
              count: nf.format(counts.all.IN_REVIEW ?? 0),
            })
          : null,
      captionTint: "#D9554C",
    },
    {
      status: "APPROVED",
      label: t("dashboard.approvedRequests"),
      tint: "#35955B",
      bg: "#E9F4EC",
      icon: <CheckCircleOutlineIcon />,
      caption:
        counts != null
          ? t("dashboard.kpi.newThisWeek", {
              count: nf.format(counts.week.APPROVED ?? 0),
            })
          : null,
      captionTint: "#35955B",
    },
    {
      status: "REJECTED",
      label: t("dashboard.rejectedRequests"),
      tint: "#7B828A",
      bg: "#EFF1F4",
      icon: <CancelOutlinedIcon />,
      caption:
        counts != null
          ? t("dashboard.kpi.newThisWeek", {
              count: nf.format(counts.week.REJECTED ?? 0),
            })
          : null,
      captionTint: "#8A8D91",
    },
    {
      status: "WITHDRAWN",
      label: t("dashboard.cancelledRequests"),
      tint: "#4A7FB8",
      bg: "#E9F0F8",
      icon: <HistoryOutlinedIcon />,
      caption:
        counts != null
          ? t("dashboard.kpi.newThisWeek", {
              count: nf.format(counts.week.WITHDRAWN ?? 0),
            })
          : null,
      captionTint: "#8A8D91",
    },
  ];

  const weekSheet = (weekSheetPage?.results ?? []).find(
    (s) => s.submitter === user?.id,
  );
  const sheetPct = weekSheet
    ? Math.min(100, Math.round((weekSheet.total_hours / REQUIRED_WEEKLY_HOURS) * 100))
    : 0;
  const sheetRemainingMin = Math.max(
    0,
    REQUIRED_WEEKLY_HOURS - (weekSheet?.total_hours ?? 0),
  ) * 60;

  const notifItems = (notifications?.results ?? []).slice(0, 3);
  const remainingMin = Math.max(0, requiredMin - workedMin);

  const signOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Page title row — small title left; date/time + check-in/out +
          sign-out on the right (reference title row). */}
      <Box
        sx={{
          mb: "22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography
          component="h1"
          sx={{ fontSize: "1.05rem", fontWeight: 650, color: "text.primary" }}
        >
          {t("dashboard.title")}
        </Typography>
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}
        >
          <Box
            sx={{
              display: { xs: "none", sm: "flex" },
              alignItems: "baseline",
              gap: 1.5,
            }}
          >
            <Typography
              sx={{ fontSize: "1.05rem", fontWeight: 650 }}
              color="text.primary"
            >
              {fmtFullDay.format(new Date())}
            </Typography>
            <Typography sx={{ fontSize: "1.05rem" }} color="text.secondary">
              {fmtClock.format(new Date())}
            </Typography>
          </Box>
          <AttendanceControl />
          <Tooltip title={t("nav.signOut")}>
            <IconButton
              aria-label={t("nav.signOut")}
              onClick={() => void signOut()}
              sx={(theme) => ({
                border: `1px solid ${theme.palette.divider}`,
                color: "text.primary",
                borderRadius: "12px",
                width: 42,
                height: 42,
                "&:hover": { bgcolor: theme.palette.action.hover },
              })}
            >
              <LogoutOutlinedIcon sx={{ fontSize: 21 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Greeting — daypart icon badge, big greeting + name, supporting line. */}
      <Box
        sx={{
          mb: "26px",
          display: "flex",
          alignItems: "center",
          gap: 2.5,
          minWidth: 0,
        }}
      >
        <IconBadge
          tint="#E31E24"
          size={54}
          icon={
            greeting === "evening" ? (
              <BedtimeOutlinedIcon />
            ) : (
              <LightModeOutlinedIcon />
            )
          }
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{
              fontSize: "2.25rem",
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "text.primary",
            }}
          >
            {t("dashboard.greeting.withName", {
              greeting: t(`dashboard.greeting.${greeting}`),
              name,
            })}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              fontSize: "1.05rem",
              fontWeight: 500,
              color: "text.secondary",
              letterSpacing: isRtl ? 0 : "0.01em",
            }}
          >
            {t(
              user?.role === "MANAGER" || user?.role === "HR"
                ? "dashboard.subtitleTeam"
                : "dashboard.subtitle",
            )}
          </Typography>
        </Box>
      </Box>

      {/* KPI cards — five pastel cards, ~152px tall at desktop. */}
      <Box
        component="section"
        aria-label={t("dashboard.requestsByStatus")}
        sx={{
          display: "grid",
          gap: "17px",
          mb: "36px",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
          },
          gridAutoRows: { lg: "140px", xl: "152px" },
        }}
      >
        {kpiCards.map((c) => (
          <KpiCard
            key={c.status}
            icon={c.icon}
            tint={c.tint}
            bg={c.bg}
            label={c.label}
            value={counts ? nf.format(counts.all[c.status]) : "—"}
            caption={c.caption}
            captionTint={c.captionTint}
            to={`/requests?status=${c.status}`}
          />
        ))}
        <KpiCard
          icon={<AccessTimeOutlinedIcon />}
          tint="#E31E24"
          bg="#FADADD"
          label={t("dashboard.todaysAttendance")}
          value={`${fmtDuration(workedMin)} / ${fmtDuration(requiredMin)}`}
          caption={attendanceState}
          to="/attendance"
          accentText
        />
      </Box>

      {/* Analytics panels — two equal chart cards, ~369px tall at desktop. */}
      <Box
        sx={{
          display: "grid",
          gap: "18px",
          mb: "26px",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1.01fr) minmax(0,1fr)" },
        }}
      >
        <PanelCard
          title={
            <ChartTitle
              text={t("dashboard.hoursLogged")}
              hint={t("dashboard.hoursLoggedHint")}
            />
          }
          subtitle={
            weekOffset === 0
              ? t("dashboard.hoursLoggedWeek")
              : t("dashboard.hoursLoggedLastWeek")
          }
          actions={
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />}
                endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
                onClick={(e) => setHoursAnchor(e.currentTarget)}
                aria-haspopup="menu"
                sx={{
                  borderRadius: "10px",
                  whiteSpace: "nowrap",
                  height: 40,
                  px: 1.75,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "text.primary",
                  borderColor: "divider",
                }}
              >
                {t(
                  weekOffset === 0
                    ? "dashboard.range.thisWeek"
                    : "dashboard.range.lastWeek",
                )}
              </Button>
              <Menu
                anchorEl={hoursAnchor}
                open={Boolean(hoursAnchor)}
                onClose={() => setHoursAnchor(null)}
              >
                <MenuItem
                  selected={weekOffset === 0}
                  onClick={() => {
                    setWeekOffset(0);
                    setHoursAnchor(null);
                  }}
                >
                  {t("dashboard.range.thisWeek")}
                </MenuItem>
                <MenuItem
                  selected={weekOffset === 1}
                  onClick={() => {
                    setWeekOffset(1);
                    setHoursAnchor(null);
                  }}
                >
                  {t("dashboard.range.lastWeek")}
                </MenuItem>
              </Menu>
            </>
          }
          contentSx={{ mt: 1 }}
          sx={{ minHeight: { lg: 330, xl: 345 } }}
        >
          <LineChart
            points={hourSeries}
            formatValue={(v) => fmtDuration(v * 60)}
          />
        </PanelCard>

        <PanelCard
          title={
            <ChartTitle
              text={t("dashboard.requestsByType")}
              hint={t("dashboard.requestsByTypeHint")}
            />
          }
          subtitle={
            typeRange === "all"
              ? t("dashboard.requestsByTypeHint")
              : t("dashboard.requestsByTypeWeekHint")
          }
          actions={
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />}
                endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
                onClick={(e) => setTypeAnchor(e.currentTarget)}
                aria-haspopup="menu"
                sx={{
                  borderRadius: "10px",
                  whiteSpace: "nowrap",
                  height: 40,
                  px: 1.75,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "text.primary",
                  borderColor: "divider",
                }}
              >
                {t(
                  typeRange === "all"
                    ? "dashboard.range.allTime"
                    : "dashboard.range.thisWeek",
                )}
              </Button>
              <Menu
                anchorEl={typeAnchor}
                open={Boolean(typeAnchor)}
                onClose={() => setTypeAnchor(null)}
              >
                <MenuItem
                  selected={typeRange === "all"}
                  onClick={() => {
                    setTypeRange("all");
                    setTypeAnchor(null);
                  }}
                >
                  {t("dashboard.range.allTime")}
                </MenuItem>
                <MenuItem
                  selected={typeRange === "week"}
                  onClick={() => {
                    setTypeRange("week");
                    setTypeAnchor(null);
                  }}
                >
                  {t("dashboard.range.thisWeek")}
                </MenuItem>
              </Menu>
            </>
          }
          contentSx={{ mt: 1 }}
          sx={{ minHeight: { lg: 330, xl: 345 } }}
        >
          {typeCounts && typeCounts.length ? (
            <BarChart bars={typeCounts} />
          ) : (
            <EmptyState message={t("dashboard.noChartData")} />
          )}
        </PanelCard>
      </Box>

      {/* Bottom information panels — reference widths ~31 / 32 / 34%. */}
      <Box
        sx={{
          display: "grid",
          gap: "17px",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0,1fr))",
            lg: "minmax(0,31fr) minmax(0,32.4fr) minmax(0,34.6fr)",
          },
          alignItems: "stretch",
        }}
      >
        {/* Recent notifications */}
        <PanelCard
          title={
            <PanelTitle
              icon={<NotificationsNoneOutlinedIcon />}
              tint="#E31E24"
              text={t("dashboard.recentNotifications")}
            />
          }
          actions={
            <CardLink to="/notifications">{t("dashboard.viewAll")}</CardLink>
          }
        >
          {notifItems.length === 0 ? (
            <EmptyState message={t("notifications.empty")} />
          ) : (
            <List disablePadding sx={{ mx: -1.5 }}>
              {notifItems.map((n) => {
                const path = itemPath(n);
                const body = (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1.75,
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={(theme) => ({
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        bgcolor: n.is_read
                          ? "transparent"
                          : theme.palette.primary.main,
                      })}
                    />
                    <IconBadge
                      size={46}
                      tint={n.item_type === "timesheet" ? "#5B7A99" : "#E31E24"}
                      icon={
                        n.item_type === "timesheet" ? (
                          <ScheduleOutlinedIcon />
                        ) : n.item_type === "request" ? (
                          <AssignmentOutlinedIcon />
                        ) : (
                          <NotificationsNoneOutlinedIcon />
                        )
                      }
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        sx={{
                          fontSize: "0.95rem",
                          fontWeight: n.is_read ? 500 : 700,
                          lineHeight: 1.35,
                        }}
                        color="text.primary"
                        noWrap
                      >
                        {n.message}
                      </Typography>
                      <Typography
                        sx={{ fontSize: "0.85rem", mt: 0.25 }}
                        color="text.secondary"
                        noWrap
                        display="block"
                      >
                        {t(`notifications.type.${n.item_type}`, {
                          defaultValue: n.item_type,
                        })}{" "}
                        · {relativeTime(n.created_at, i18n.language)}
                      </Typography>
                    </Box>
                  </Box>
                );
                return (
                  <Box
                    key={n.id}
                    sx={{
                      px: 1,
                      py: 1.4,
                      borderRadius: 2,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    {path ? <AppLink to={path}>{body}</AppLink> : body}
                  </Box>
                );
              })}
            </List>
          )}
        </PanelCard>

        {/* This week's timesheet */}
        <PanelCard
          title={
            <PanelTitle
              icon={<CalendarMonthOutlinedIcon />}
              tint="#E31E24"
              text={t("dashboard.weekTimesheet")}
            />
          }
          actions={
            weekSheet ? (
              <CardLink to={`/timesheets/${weekSheet.id}`}>
                {t("dashboard.viewTimesheet")}
              </CardLink>
            ) : undefined
          }
        >
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 3.5, mt: 1 }}
          >
            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <CircularProgress
                variant="determinate"
                value={100}
                size={118}
                thickness={6}
                sx={{ color: "action.hover", position: "absolute" }}
              />
              <CircularProgress
                variant="determinate"
                value={sheetPct}
                size={118}
                thickness={6}
                sx={{
                  color: "primary.main",
                  "& .MuiCircularProgress-circle": {
                    strokeLinecap: "round",
                  },
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography
                  component="p"
                  fontWeight={800}
                  sx={{ fontSize: "1.5rem", lineHeight: 1.2 }}
                >
                  {nf.format(sheetPct)}%
                </Typography>
                <Typography
                  sx={{ fontSize: "0.85rem" }}
                  color="text.secondary"
                >
                  {t("dashboard.submittedShort")}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component="p"
                fontWeight={800}
                sx={{ fontSize: "1.8rem", lineHeight: 1.2 }}
              >
                {fmtDuration((weekSheet?.total_hours ?? 0) * 60)} /{" "}
                {fmtDuration(REQUIRED_WEEKLY_HOURS * 60)}
              </Typography>
              <Typography sx={{ fontSize: "0.95rem" }} color="text.secondary">
                {t("dashboard.hoursSubmitted")}
              </Typography>
              <Box
                sx={(theme) => ({
                  my: 1.75,
                  height: 7,
                  borderRadius: 4,
                  bgcolor: theme.palette.action.hover,
                  overflow: "hidden",
                })}
              >
                <Box
                  sx={(theme) => ({
                    height: "100%",
                    width: `${sheetPct}%`,
                    borderRadius: 4,
                    bgcolor: theme.palette.primary.main,
                    transition: "width 200ms ease",
                  })}
                />
              </Box>
              {weekSheet ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <StatusBadge status={weekSheet.status} />
                  <Typography
                    sx={{ fontSize: "0.85rem" }}
                    color="text.secondary"
                  >
                    {fmtDuration(sheetRemainingMin)}{" "}
                    {t("dashboard.remainingHours")}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  sx={{ fontSize: "0.9rem", display: "block" }}
                  color="text.secondary"
                >
                  {t("dashboard.noTimesheet")}
                </Typography>
              )}
              {!weekSheet && (
                <Box sx={{ mt: 1.75 }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    component={RouterLink}
                    to="/timesheets/new"
                    sx={{
                      height: 44,
                      px: 2.5,
                      borderRadius: "10px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                    }}
                  >
                    {t("timesheets.new")}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        </PanelCard>

        {/* Today's attendance */}
        <PanelCard
          title={
            <PanelTitle
              icon={<AccessTimeOutlinedIcon />}
              tint="#E31E24"
              text={t("dashboard.todaysAttendance")}
            />
          }
          actions={
            <CardLink to="/attendance">{t("dashboard.viewDetails")}</CardLink>
          }
        >
          {/* Horizontal check-in → check-out timeline */}
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              position: "relative",
              mb: 3,
              mt: 1,
              px: 0.5,
            }}
          >
            <Box
              aria-hidden
              sx={(theme) => ({
                position: "absolute",
                top: 66,
                insetInlineStart: 52,
                insetInlineEnd: 52,
                borderTop: `2px solid ${theme.palette.divider}`,
              })}
            />
            <TimelineStop
              tint={firstCheckIn ? "success.main" : "text.disabled"}
              label={t("timesheets.checkIn")}
              time={firstCheckIn ? fmtTime(firstCheckIn) : "--:--"}
              circle={
                <CheckCircleIcon
                  sx={{
                    fontSize: 42,
                    color: firstCheckIn ? "success.main" : "text.disabled",
                    bgcolor: "background.paper",
                    borderRadius: "50%",
                  }}
                />
              }
            />
            <TimelineStop
              tint={lastCheckOut ? "text.primary" : "text.disabled"}
              label={t("timesheets.checkOut")}
              time={lastCheckOut ? fmtTime(lastCheckOut) : "--:--"}
              circle={
                <Box
                  sx={(theme) => ({
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: lastCheckOut
                      ? alpha(theme.palette.primary.main, 0.12)
                      : theme.palette.action.hover,
                    color: lastCheckOut
                      ? theme.palette.primary.main
                      : theme.palette.text.disabled,
                  })}
                >
                  <LogoutOutlinedIcon sx={{ fontSize: 22 }} />
                </Box>
              }
            />
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <InfoTile
              label={t("dashboard.workedDuration")}
              value={fmtDuration(workedMin)}
            />
            <InfoTile
              label={t("dashboard.remaining")}
              value={fmtDuration(remainingMin)}
            />
          </Box>
        </PanelCard>
      </Box>
    </>
  );
}
