import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";

import { History } from "../../components/History";
import { ReviewActions } from "../../components/ReviewActions";
import {
  ErrorAlert,
  LoadingState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../../components/ui";
import { get } from "../../lib/api";
import { useFormatDuration } from "../../lib/format";
import type { Timesheet } from "../../types";

const BASE = "/api/timesheets";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  );
}

export default function TimesheetDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const fmtMin = useFormatDuration();
  const { data: item, isLoading, error } = useQuery({
    queryKey: ["timesheet", id],
    queryFn: () => get<Timesheet>(`${BASE}/${id}/`),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorAlert error={error} />;
  if (!item) return null;

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString(i18n.language, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const fmtDuration = (seconds: number) => fmtMin(seconds / 60);

  // `days` is the deterministic per-day view from the backend: every day of
  // the week with its attendance (check-in/out/worked) and manual hours.
  const rows = item.days ?? [];
  const workedTotalSec = rows.reduce((s, r) => s + r.worked_seconds, 0);
  const manualTotal = item.total_hours;

  return (
    <>
      <PageHeader
        title={t("timesheets.weekOf", { date: item.week_start })}
        subtitle={<StatusBadge status={item.status} />}
      />

      <Grid container spacing={2.5} alignItems="flex-start">
        {/* Main column — entries + actions */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <SectionCard title={t("timesheets.entriesTitle")}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  mb: 3,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                }}
              >
                <Field
                  label={t("timesheets.employee")}
                  value={item.submitter_email}
                />
                <Field
                  label={t("timesheets.manualHours")}
                  value={`${manualTotal}h`}
                />
                <Field
                  label={t("timesheets.attendanceHours")}
                  value={
                    workedTotalSec > 0 ? fmtDuration(workedTotalSec) : "—"
                  }
                />
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("timesheets.date")}</TableCell>
                    <TableCell>{t("timesheets.checkIn")}</TableCell>
                    <TableCell>{t("timesheets.checkOut")}</TableCell>
                    <TableCell align="right">{t("timesheets.worked")}</TableCell>
                    <TableCell align="right">{t("timesheets.hours")}</TableCell>
                    <TableCell align="right">
                      {t("timesheets.dayTotal")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.date} hover>
                      <TableCell>{fmtDay(r.date)}</TableCell>
                      <TableCell>{fmtTime(r.check_in_at)}</TableCell>
                      <TableCell>
                        {r.has_open ? (
                          <Chip
                            size="small"
                            color="success"
                            variant="outlined"
                            label={t("attendance.inProgress")}
                          />
                        ) : (
                          fmtTime(r.check_out_at)
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {r.worked_seconds > 0
                          ? fmtDuration(r.worked_seconds)
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {r.manual_hours != null ? `${r.manual_hours}h` : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {(
                            (r.manual_hours ?? 0) +
                            r.worked_seconds / 3600
                          ).toFixed(2)}
                          h
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" fontWeight={700}>
                        {t("timesheets.weekTotal")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}>
                        {manualTotal}h
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="primary.main"
                      >
                        {(manualTotal + workedTotalSec / 3600).toFixed(2)}h
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </SectionCard>

            {(item.actions?.length ?? 0) > 0 && (
              <SectionCard>
                <ReviewActions
                  basePath={BASE}
                  itemId={item.id}
                  actions={item.actions ?? []}
                />
              </SectionCard>
            )}
          </Stack>
        </Grid>

        {/* Sidebar — history */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <SectionCard title={t("history.title")}>
            <History basePath={BASE} itemId={item.id} />
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
