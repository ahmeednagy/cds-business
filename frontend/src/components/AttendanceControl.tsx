import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, Snackbar, Tooltip } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";

import { get, post } from "../lib/api";
import type { AttendanceSession, AttendanceToday } from "../types";

/**
 * Header check-in/check-out control. The backend is the source of truth —
 * state is read from GET /api/attendance/today/ on every mount/refocus, so it
 * survives refreshes; timestamps are recorded server-side.
 */
export function AttendanceControl() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    msg: string;
  } | null>(null);

  const { data } = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => get<AttendanceToday>("/api/attendance/today/"),
    refetchInterval: 60_000,
  });
  const active = data?.active ?? null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    // Timesheet detail/list embed attendance — keep them in sync too.
    queryClient.invalidateQueries({ queryKey: ["timesheet"] });
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  };

  const checkIn = useMutation({
    mutationFn: () =>
      post<AttendanceSession>("/api/attendance/check-in/"),
    onSuccess: () => {
      refresh();
      setToast({ kind: "success", msg: t("attendance.checkedIn") });
    },
    onError: () => setToast({ kind: "error", msg: t("attendance.checkInFailed") }),
  });

  const checkOut = useMutation({
    mutationFn: () =>
      post<AttendanceSession>("/api/attendance/check-out/"),
    onSuccess: () => {
      refresh();
      setToast({ kind: "success", msg: t("attendance.checkedOut") });
    },
    onError: () =>
      setToast({ kind: "error", msg: t("attendance.checkOutFailed") }),
  });

  const busy = checkIn.isPending || checkOut.isPending;
  const checkedInAt = active
    ? new Date(active.check_in_at).toLocaleTimeString(i18n.language, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const button = (
    <Tooltip
      title={active && checkedInAt ? t("attendance.since", { time: checkedInAt }) : ""}
    >
      <span>
        <Button
          variant={active ? "outlined" : "contained"}
          color={active ? "inherit" : "primary"}
          disabled={busy}
          onClick={() => (active ? checkOut.mutate() : checkIn.mutate())}
          startIcon={active ? <LogoutOutlinedIcon /> : <LoginOutlinedIcon />}
          sx={(theme) => ({
            whiteSpace: "nowrap",
            borderRadius: "12px",
            height: 42,
            px: 2.5,
            fontSize: "1rem",
            fontWeight: 600,
            ...(active
              ? {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.primary,
                }
              : {}),
          })}
        >
          {busy
            ? t("common.loading")
            : active
              ? t("attendance.checkOut")
              : t("attendance.checkIn")}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        {button}
      </Box>
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast?.kind}
          variant="filled"
          onClose={() => setToast(null)}
        >
          {toast?.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
