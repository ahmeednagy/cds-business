import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  alpha,
  Box,
  Card,
  Divider,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import FreeBreakfastOutlinedIcon from "@mui/icons-material/FreeBreakfastOutlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { AttendanceControl } from "../../components/AttendanceControl";
import {
  EmptyState,
  ErrorAlert,
  IconBadge,
  TableSkeleton,
} from "../../components/ui";
import { get } from "../../lib/api";
import {
  REQUIRED_DAILY_HOURS,
  workedSecondsToday,
} from "../../lib/attendance";
import { businessWeek, localISO, mondayOf } from "../../lib/dates";
import { useFormatDuration, useNumberFormat } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import { isRtlLanguage } from "../../i18n";
import type { AttendanceSession, AttendanceToday, AttendanceWeek } from "../../types";

interface DayRow {
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  sessions: number;
  workedSeconds: number;
  breakSeconds: number;
}

/* ---------- Summary card (reference four-card row) ---------- */

function SummaryCard({
  icon,
  tint,
  bg,
  label,
  value,
  caption,
}: {
  icon: ReactNode;
  tint: string;
  bg: string;
  label: string;
  value: ReactNode;
  caption: string;
}) {
  return (
    <Card
      sx={(theme) => ({
        borderRadius: "16px",
        height: "100%",
        bgcolor: theme.palette.mode === "dark" ? alpha(tint, 0.16) : bg,
        borderColor: alpha(tint, theme.palette.mode === "dark" ? 0.35 : 0.25),
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 2.5 }}>
        <IconBadge icon={icon} tint={tint} size={48} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ fontSize: "0.85rem", fontWeight: 600 }}
            color="text.secondary"
            noWrap
          >
            {label}
          </Typography>
          <Typography
            component="p"
            fontWeight={800}
            sx={{ fontSize: "1.55rem", lineHeight: 1.25 }}
            noWrap
          >
            {value}
          </Typography>
          <Typography sx={{ fontSize: "0.8rem" }} color="text.secondary" noWrap>
            {caption}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

/* ---------- Time block inside the Today card ---------- */

function TimeBlock({
  icon,
  tint,
  label,
  time,
}: {
  icon: ReactNode;
  tint: string;
  label: string;
  time: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <IconBadge size={38} tint={tint} icon={icon} />
      <Box>
        <Typography
          sx={{ fontSize: "0.8rem" }}
          color="text.secondary"
          display="block"
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700 }}>
          {time}
        </Typography>
      </Box>
    </Box>
  );
}

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const nf = useNumberFormat();
  const fmtDuration = useFormatDuration();
  const isRtl = isRtlLanguage(i18n.language);
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: today, isLoading, error } = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => get<AttendanceToday>("/api/attendance/today/"),
    refetchInterval: 60_000,
  });

  // Selected Sun–Sat business week; offset shifts it by whole weeks.
  const bizStart = useMemo(() => {
    const d = new Date(businessWeek(mondayOf(new Date())).start);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const bizEnd = useMemo(() => {
    const d = new Date(bizStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [bizStart]);

  // The API is Monday-anchored, so a Sun–Sat week spans two queries:
  // the Monday week containing Sunday, and the one containing Monday.
  const sundayIso = localISO(bizStart);
  const monday = useMemo(() => {
    const d = new Date(bizStart);
    d.setDate(d.getDate() + 1);
    return localISO(d);
  }, [bizStart]);

  const { data: weekPrev } = useQuery({
    queryKey: ["attendance", "week", sundayIso],
    queryFn: () => get<AttendanceWeek>(`/api/attendance/week/?start=${sundayIso}`),
  });
  const { data: weekCurr } = useQuery({
    queryKey: ["attendance", "week", monday],
    queryFn: () => get<AttendanceWeek>(`/api/attendance/week/?start=${monday}`),
  });

  // Own sessions only — managers/HR see team sessions in this endpoint too.
  const ownSessions = useMemo(() => {
    const all = [...(weekPrev?.results ?? []), ...(weekCurr?.results ?? [])];
    const seen = new Set<number>();
    return all.filter(
      (s) => s.submitter === user?.id && !seen.has(s.id) && seen.add(s.id),
    );
  }, [weekPrev, weekCurr, user?.id]);

  const bizDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(bizStart);
        d.setDate(d.getDate() + i);
        return localISO(d);
      }),
    [bizStart],
  );

  const dayRows = useMemo<DayRow[]>(() => {
    const now = new Date();
    return bizDays.map((iso) => {
      const sessions = ownSessions
        .filter((s) => s.work_date === iso)
        .sort((a, b) => a.check_in_at.localeCompare(b.check_in_at));
      const worked = sessions.reduce((sum, s) => {
        if (s.worked_seconds != null) return sum + s.worked_seconds;
        const end = s.check_out_at ? new Date(s.check_out_at) : now;
        return (
          sum +
          Math.max(0, (end.getTime() - new Date(s.check_in_at).getTime()) / 1000)
        );
      }, 0);
      // Honest break time: gaps between consecutive sessions on the same day.
      let breakSec = 0;
      for (let i = 1; i < sessions.length; i++) {
        const prevOut = sessions[i - 1].check_out_at
          ? new Date(sessions[i - 1].check_out_at!)
          : now;
        const nextIn = new Date(sessions[i].check_in_at);
        breakSec += Math.max(0, (nextIn.getTime() - prevOut.getTime()) / 1000);
      }
      return {
        date: iso,
        firstIn: sessions.at(0)?.check_in_at ?? null,
        lastOut:
          [...sessions]
            .filter((s) => s.check_out_at)
            .sort((a, b) => b.check_out_at!.localeCompare(a.check_out_at!))
            .at(0)?.check_out_at ?? null,
        sessions: sessions.length,
        workedSeconds: worked,
        breakSeconds: breakSec,
      };
    });
  }, [ownSessions, bizDays]);

  if (isLoading) return <TableSkeleton rows={4} />;
  if (error) return <ErrorAlert error={error} />;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDay = new Intl.DateTimeFormat(i18n.language, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const fmtRange = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
  });

  const sessions: AttendanceSession[] = today?.sessions ?? [];
  const firstCheckIn = [...sessions]
    .filter((s) => s.check_in_at)
    .sort((a, b) => a.check_in_at.localeCompare(b.check_in_at))
    .at(0)?.check_in_at;
  const lastCheckOut = [...sessions]
    .filter((s) => s.check_out_at)
    .sort((a, b) => b.check_out_at!.localeCompare(a.check_out_at!))
    .at(0)?.check_out_at;

  const workedMin = Math.floor(workedSecondsToday(today) / 60);
  const requiredMin = REQUIRED_DAILY_HOURS * 60;
  const pct = Math.min(100, Math.round((workedMin / requiredMin) * 100));
  const weekWorkedMin = Math.floor(
    dayRows.reduce((sum, r) => sum + r.workedSeconds, 0) / 60,
  );
  const daysPresent = dayRows.filter((r) => r.sessions > 0).length;
  const breakMin = Math.floor(
    dayRows.reduce((sum, r) => sum + r.breakSeconds, 0) / 60,
  );
  // Denominator: days elapsed in the selected week (7 for past weeks).
  const todayIso = localISO(new Date());
  const elapsedDays = Math.min(
    7,
    bizDays.filter((d) => d <= todayIso).length || 7,
  );
  const attendanceRate = Math.round((daysPresent / elapsedDays) * 100);

  const stateLabel = today?.active
    ? t("attendance.state.checkedIn", {
        time: fmtTime(today.active.check_in_at),
      })
    : lastCheckOut
      ? t("attendance.state.checkedOut", { time: fmtTime(lastCheckOut) })
      : t("attendance.state.notCheckedIn");

  const rangeLabel = `${fmtRange.format(bizStart)} – ${fmtRange.format(bizEnd)}`;
  const PrevIcon = isRtl ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <>
      {/* Page heading — title + subtitle left, Check In/Out upper-right. */}
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
            sx={{ fontSize: "1.4rem", fontWeight: 700, color: "text.primary" }}
          >
            {t("attendance.title")}
          </Typography>
          <Typography sx={{ fontSize: "0.95rem" }} color="text.secondary">
            {t("attendance.subtitle")}
          </Typography>
        </Box>
        <AttendanceControl />
      </Box>

      {/* Today card — pale red, clock icon, state, in/out blocks, progress. */}
      <Card
        sx={(theme) => ({
          borderRadius: "16px",
          mb: 3,
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.primary.main, 0.16)
              : "#FADADD",
          borderColor: alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.35 : 0.25,
          ),
        })}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            px: 3,
            py: 2.5,
            flexWrap: { xs: "wrap", xl: "nowrap" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.75,
              minWidth: 0,
            }}
          >
            <IconBadge
              size={48}
              tint="#E31E24"
              icon={<AccessTimeOutlinedIcon />}
            />
            <Box>
              <Typography sx={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {t("attendance.todayCard")}
              </Typography>
              <Typography
                sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#B4232B" }}
              >
                {stateLabel}
              </Typography>
            </Box>
          </Box>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ display: { xs: "none", md: "block" } }}
          />
          <TimeBlock
            icon={<LoginOutlinedIcon />}
            tint="#2F7D4F"
            label={t("timesheets.checkIn")}
            time={firstCheckIn ? fmtTime(firstCheckIn) : "--:--"}
          />
          <TimeBlock
            icon={<LogoutOutlinedIcon />}
            tint="#8A8D91"
            label={t("timesheets.checkOut")}
            time={lastCheckOut ? fmtTime(lastCheckOut) : "--:--"}
          />

          <Divider
            orientation="vertical"
            flexItem
            sx={{ display: { xs: "none", md: "block" } }}
          />
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                mb: 0.75,
              }}
            >
              <Typography sx={{ fontSize: "0.85rem" }} color="text.secondary">
                {t("dashboard.workedDuration")}:{" "}
                <Box component="b" sx={{ fontWeight: 700 }}>
                  {fmtDuration(workedMin)}
                </Box>{" "}
                / {fmtDuration(requiredMin)}
              </Typography>
              <Typography
                sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#B4232B" }}
              >
                {nf.format(pct)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 7,
                borderRadius: 4,
                bgcolor: alpha("#E31E24", 0.18),
                "& .MuiLinearProgress-bar": {
                  borderRadius: 4,
                  bgcolor: "#E31E24",
                },
              }}
            />
          </Box>
        </Box>
      </Card>

      {/* Four weekly summary cards — pastel, icon, metric, caption. */}
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
        <SummaryCard
          icon={<AccessTimeOutlinedIcon />}
          tint="#2F6FED"
          bg="#DDE8F5"
          label={t("attendance.summary.totalHours")}
          value={fmtDuration(weekWorkedMin)}
          caption={t("attendance.weekCard")}
        />
        <SummaryCard
          icon={<EventAvailableOutlinedIcon />}
          tint="#2F7D4F"
          bg="#D8EDD9"
          label={t("attendance.summary.daysPresent")}
          value={nf.format(daysPresent)}
          caption={t("attendance.summary.ofDays", { count: elapsedDays })}
        />
        <SummaryCard
          icon={<FreeBreakfastOutlinedIcon />}
          tint="#B07A1E"
          bg="#FDE8C8"
          label={t("attendance.summary.breakTime")}
          value={fmtDuration(breakMin)}
          caption={t("attendance.summary.betweenSessions")}
        />
        <SummaryCard
          icon={<PercentOutlinedIcon />}
          tint="#E31E24"
          bg="#FADADD"
          label={t("attendance.summary.rate")}
          value={`${nf.format(attendanceRate)}%`}
          caption={t("attendance.summary.ofDays", { count: elapsedDays })}
        />
      </Box>

      {/* Weekly table — This Week (Sun–Sat), date range + week nav. */}
      <Card sx={{ borderRadius: "16px" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: 3,
            pt: 2.5,
            pb: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700 }}>
              {t("attendance.weekCard")}
            </Typography>
            <Typography sx={{ fontSize: "0.9rem" }} color="text.secondary">
              {rangeLabel} · {fmtDuration(weekWorkedMin)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton
              size="small"
              aria-label={t("attendance.prevWeek")}
              onClick={() => setWeekOffset((o) => o - 1)}
              sx={{ border: 1, borderColor: "divider", borderRadius: "10px" }}
            >
              <PrevIcon fontSize="small" />
            </IconButton>
            <Typography
              sx={{
                px: 1.5,
                fontSize: "0.95rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {rangeLabel}
            </Typography>
            <IconButton
              size="small"
              aria-label={t("attendance.nextWeek")}
              onClick={() => setWeekOffset((o) => o + 1)}
              disabled={weekOffset >= 0}
              sx={{ border: 1, borderColor: "divider", borderRadius: "10px" }}
            >
              <NextIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {dayRows.every((r) => r.sessions === 0) && weekOffset === 0 ? (
          <Box sx={{ px: 3, pb: 2 }}>
            <EmptyState message={t("attendance.noSessions")} />
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table aria-label={t("attendance.weekCard")}>
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
                      py: 1.5,
                    },
                  })}
                >
                  <TableCell>{t("attendance.col.date")}</TableCell>
                  <TableCell>{t("timesheets.checkIn")}</TableCell>
                  <TableCell>{t("timesheets.checkOut")}</TableCell>
                  <TableCell align="center">
                    {t("attendance.col.sessions")}
                  </TableCell>
                  <TableCell align="right">{t("timesheets.worked")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dayRows.map((r) => {
                  const isToday = r.date === todayIso;
                  return (
                    <TableRow
                      key={r.date}
                      sx={(theme) => ({
                        bgcolor: isToday
                          ? theme.palette.mode === "dark"
                            ? alpha(theme.palette.primary.main, 0.1)
                            : alpha("#E31E24", 0.06)
                          : "transparent",
                        "& td": {
                          px: 3,
                          py: 1.75,
                          fontSize: "0.95rem",
                          fontWeight: isToday ? 600 : 400,
                          borderColor: "divider",
                        },
                        "&:last-child td": { borderBottom: "none" },
                      })}
                    >
                      <TableCell>
                        {fmtDay.format(new Date(`${r.date}T00:00:00`))}
                        {isToday ? ` · ${t("attendance.todayMarker")}` : ""}
                      </TableCell>
                      <TableCell>
                        {r.firstIn ? fmtTime(r.firstIn) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.lastOut ? fmtTime(r.lastOut) : "—"}
                      </TableCell>
                      <TableCell align="center">
                        {r.sessions ? nf.format(r.sessions) : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {r.sessions ? fmtDuration(r.workedSeconds / 60) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
    </>
  );
}
