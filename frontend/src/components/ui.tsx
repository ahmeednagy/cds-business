import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  Pagination,
  Skeleton,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";

import { ApiError } from "../lib/api";
import { colors } from "../theme";

/* ---------- Error mapping ---------- */

/** Map any thrown error to a localized, user-safe message (FR-041 — never
 * surface raw backend internals). ApiError codes come from the backend
 * error envelope; anything else is treated as a network/unknown failure. */
export function friendlyErrorMessage(
  error: unknown,
  t: (key: string) => string,
): string {
  if (error instanceof ApiError) {
    const key =
      {
        unauthenticated: "errors.unauthenticated",
        forbidden: "errors.forbidden",
        not_found: "errors.not_found",
        conflict: "errors.conflict",
        throttled: "errors.throttled",
        validation_error: "errors.validation_error",
        invalid_token: "errors.invalid_token",
      }[error.code] ?? "errors.generic";
    return t(key);
  }
  return t("errors.network");
}

export function ErrorAlert({
  error,
  message,
  sx,
}: {
  error: unknown;
  message?: string;
  sx?: SxProps<Theme>;
}) {
  const { t } = useTranslation();
  return (
    <Alert severity="error" role="alert" sx={sx}>
      {message ?? friendlyErrorMessage(error, t)}
    </Alert>
  );
}

/** Full-width error block for page-level failures. */
export function ErrorState({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return (
    <Card sx={{ p: 4, textAlign: "center" }}>
      <Typography variant="subtitle1" gutterBottom>
        {t("errors.generic")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {friendlyErrorMessage(error, t)}
      </Typography>
    </Card>
  );
}

/* ---------- Status ---------- */

/** Soft-tint chip styles per workflow status — red family + neutrals. */
const STATUS_STYLE: Record<
  string,
  (theme: Theme) => { bgcolor: string; color: string }
> = {
  PENDING: (theme) => ({
    bgcolor: theme.palette.action.selected,
    color: theme.palette.primary.main,
  }),
  IN_REVIEW: (theme) => ({
    bgcolor: theme.palette.action.hover,
    color: theme.palette.text.primary,
  }),
  RETURNED: (theme) => ({
    bgcolor:
      theme.palette.mode === "dark"
        ? "rgba(183,121,31,0.20)"
        : "rgba(183,121,31,0.12)",
    color: theme.palette.warning.main,
  }),
  APPROVED: (theme) => ({
    bgcolor:
      theme.palette.mode === "dark"
        ? "rgba(47,125,79,0.22)"
        : "rgba(47,125,79,0.10)",
    color: theme.palette.success.main,
  }),
  REJECTED: (theme) => ({
    bgcolor:
      theme.palette.mode === "dark" ? "rgba(214,58,63,0.18)" : "#F8E3E3",
    color: theme.palette.error.main,
  }),
  WITHDRAWN: (theme) => ({
    bgcolor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  }),
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const style = STATUS_STYLE[status];
  return (
    <Chip
      size="small"
      variant="filled"
      label={t(`status.${status}`, { defaultValue: status })}
      sx={(theme) => ({
        fontSize: "0.75rem",
        height: 24,
        ...(style ? style(theme) : { bgcolor: theme.palette.action.hover }),
      })}
    />
  );
}

/** Tinted circular icon container — shared visual token for stat cards,
 * notification rows and section headers. Pass a solid `tint` color; the chip
 * renders it at ~14% alpha over the card surface in both color modes. */
export function IconBadge({
  icon,
  tint,
  size = 44,
}: {
  icon: ReactNode;
  tint: string;
  size?: number;
}) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        bgcolor:
          theme.palette.mode === "dark" ? alpha(tint, 0.22) : alpha(tint, 0.12),
        color: tint,
        "& .MuiSvgIcon-root": { fontSize: size * 0.5 },
      })}
    >
      {icon}
    </Box>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      variant="outlined"
      label={t(`role.${role}`, { defaultValue: role })}
      sx={{ height: 24, fontSize: "0.75rem" }}
    />
  );
}

/* ---------- States ---------- */

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <Stack
      alignItems="center"
      spacing={2}
      sx={{ py: 8 }}
      role="status"
      aria-label={t("common.loading")}
    >
      <CircularProgress size={32} />
      <Typography variant="body2" color="text.secondary">
        {label ?? t("common.loading")}
      </Typography>
    </Stack>
  );
}

/** Skeleton rows for table/card loading — replaces abrupt spinners. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={36} />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={44} />
        ))}
      </Stack>
    </Card>
  );
}

export function CardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={96}
          sx={{ flex: "1 1 180px", minWidth: 180 }}
        />
      ))}
    </Stack>
  );
}

export function EmptyState({
  message,
  icon,
  action,
}: {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 7 }}>
      {icon ?? (
        <InboxOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
      )}
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
      {action}
    </Stack>
  );
}

/* ---------- Page scaffolding ---------- */

/** CDS Business lockup — the logo mark with "Business" set directly under the
 * CDS letters (in logo.png the "C" spans x=45–71 of 133; the indent lands at
 * ~x=60, the middle/right of the C, derived from the rendered height so the
 * lockup stays proportional at any size). */
export function LogoLockup({ height = 34 }: { height?: number }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: "inline-block" }}>
      <Box
        component="img"
        src="/logo.png"
        alt={t("app.name")}
        sx={{ height, width: "auto", display: "block" }}
      />
      <Typography
        component="span"
        sx={{
          display: "block",
          mt: 0.5,
          // Physical margin: logo.png is LTR artwork, so the indent must not
          // flip under RTL — it always sits under the middle/right of the "C".
          ml: `${Math.round((height * 60) / 39)}px`,
          fontSize: "0.9rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: colors.midGray,
        }}
      >
        {t("app.subtitle")}
      </Typography>
    </Box>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", sm: "flex-start" }}
      justifyContent="space-between"
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} alignItems="center">
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

/** Standard content card — white, 1px border, consistent padding. */
export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  sx,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Card sx={sx}>
      {(title || actions) && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 2.5,
            pt: 2,
            pb: title ? 1 : 2,
          }}
        >
          <Box>
            <Typography variant="subtitle1">{title}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions}
        </Box>
      )}
      <CardContent sx={{ pt: title ? 1 : 2.5, "&:last-child": { pb: 2.5 } }}>
        {children}
      </CardContent>
    </Card>
  );
}

/** Bordered bar for filters/search above tables, with optional trailing actions. */
export function FilterBar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card sx={{ px: 2, py: 1.5, mb: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        flexWrap="wrap"
        useFlexGap
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "center" }}
          flexWrap="wrap"
          useFlexGap
          sx={{ flexGrow: 1 }}
        >
          {children}
        </Stack>
        {actions}
      </Stack>
    </Card>
  );
}

/* ---------- Dialogs ---------- */

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  loading,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      {body && (
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {body}
          </Typography>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          color={danger ? "error" : "primary"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : null}
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------- Pagination ---------- */

export function PaginationControls({
  count,
  page,
  pageSize,
  onPage,
}: {
  count: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems="center"
      justifyContent="space-between"
      sx={{ mt: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        {t("pagination.page", { page, pages, count })}
      </Typography>
      <Pagination
        count={pages}
        page={page}
        onChange={(_, p) => onPage(p)}
        color="primary"
        size="small"
        siblingCount={0}
        aria-label={t("pagination.label")}
      />
    </Stack>
  );
}

/* ---------- Links / misc ---------- */

export function AppLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <MuiLink component={RouterLink} to={to}>
      {children}
    </MuiLink>
  );
}
