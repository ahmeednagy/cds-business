import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { ErrorAlert, PageHeader, SectionCard } from "../../components/ui";
import { get, post } from "../../lib/api";
import { localISO, mondayOf } from "../../lib/dates";
import { useFormatDuration } from "../../lib/format";
import type { AttendanceWeek, Timesheet } from "../../types";

export default function NewTimesheetPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<Error | null>(null);

  // Week start comes from the user's LOCAL date (never the server clock):
  // default = Monday of the current week; a picked date snaps to its week's
  // Monday via the same rule (Sunday → the next day).
  const weekStart = mondayOf(picked ? new Date(`${picked}T00:00:00`) : new Date());

  const { data: week } = useQuery({
    queryKey: ["attendance", "week", weekStart],
    queryFn: () => get<AttendanceWeek>(`/api/attendance/week/?start=${weekStart}`),
  });

  const days = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return localISO(d);
    });
  }, [weekStart]);
  const attendanceByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        checkIn: string | null;
        checkOut: string | null;
        hasOpen: boolean;
        workedSeconds: number;
      }
    >();
    for (const s of week?.results ?? []) {
      const prev = map.get(s.work_date) ?? {
        checkIn: null,
        checkOut: null,
        hasOpen: false,
        workedSeconds: 0,
      };
      if (!prev.checkIn || s.check_in_at < prev.checkIn) {
        prev.checkIn = s.check_in_at;
      }
      if (s.check_out_at) {
        if (!prev.checkOut || s.check_out_at > prev.checkOut) {
          prev.checkOut = s.check_out_at;
        }
      } else {
        prev.hasOpen = true;
      }
      prev.workedSeconds += s.worked_seconds ?? 0;
      map.set(s.work_date, prev);
    }
    return map;
  }, [week]);

  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(i18n.language, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const fmtMin = useFormatDuration();
  const fmtDuration = (seconds: number) => fmtMin(seconds / 60);

  const total = days.reduce(
    (sum, d) => sum + (Number(hours[d]) || 0),
    0,
  );
  const workedTotalSec = days.reduce(
    (sum, d) => sum + (attendanceByDate.get(d)?.workedSeconds ?? 0),
    0,
  );

  const create = useMutation({
    mutationFn: () =>
      post<Timesheet>("/api/timesheets/", {
        week_start: weekStart,
        entries: days
          .filter((d) => (hours[d] ?? "") !== "")
          .map((d) => ({ date: d, hours: Number(hours[d]) })),
      }),
    onSuccess: (item) => navigate(`/timesheets/${item.id}`),
    onError: setServerError,
  });

  const hasEntry = days.some((d) => (hours[d] ?? "") !== "");

  return (
    <>
      <PageHeader
        title={t("timesheets.newTitle")}
        subtitle={t("timesheets.newSubtitle")}
      />
      <SectionCard sx={{ maxWidth: 720 }} title={t("timesheets.entriesTitle")}>
        <Stack spacing={2.5}>
          <TextField
            id="week_start"
            type="date"
            required
            fullWidth
            label={t("timesheets.weekStarting")}
            value={weekStart}
            onChange={(e) => setPicked(e.target.value || null)}
            InputLabelProps={{ shrink: true }}
          />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("timesheets.day")}</TableCell>
                <TableCell>{t("timesheets.checkIn")}</TableCell>
                <TableCell>{t("timesheets.checkOut")}</TableCell>
                <TableCell align="right">{t("timesheets.worked")}</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>
                  {t("timesheets.hours")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {days.map((d) => {
                const att = attendanceByDate.get(d);
                return (
                  <TableRow key={d} hover>
                    <TableCell>
                      {new Date(`${d}T00:00:00`).toLocaleDateString(
                        i18n.language,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </TableCell>
                    <TableCell>{fmtTime(att?.checkIn ?? null)}</TableCell>
                    <TableCell>
                      {att?.hasOpen ? (
                        <Chip
                          size="small"
                          color="success"
                          variant="outlined"
                          label={t("attendance.inProgress")}
                        />
                      ) : (
                        fmtTime(att?.checkOut ?? null)
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {att && att.workedSeconds > 0
                        ? fmtDuration(att.workedSeconds)
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        fullWidth
                        inputProps={{ min: 0, max: 24, step: 0.25 }}
                        aria-label={t("timesheets.hoursFor", { date: d })}
                        value={hours[d] ?? ""}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [d]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    {t("timesheets.weekTotal")}
                  </Typography>
                </TableCell>
                <TableCell colSpan={2} />
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>
                    {workedTotalSec > 0 ? fmtDuration(workedTotalSec) : "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="primary.main"
                  >
                    {total}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {serverError && <ErrorAlert error={serverError} />}
          <Box>
            <Button
              variant="contained"
              size="large"
              disabled={!hasEntry || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending
                ? t("common.submitting")
                : t("timesheets.submitTimesheet")}
            </Button>
          </Box>
        </Stack>
      </SectionCard>
    </>
  );
}
