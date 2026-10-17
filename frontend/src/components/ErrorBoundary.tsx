import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";

function BoundaryFallback() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Card sx={{ maxWidth: 420, textAlign: "center" }} role="alert">
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t("errors.boundary.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("errors.boundary.body")}
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 3 }}
            onClick={() => window.location.assign("/")}
          >
            {t("common.backToDashboard")}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

/** Safe error boundary — renders a generic message, never internals (FR-041). */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled UI error", error);
  }

  render() {
    if (this.state.hasError) return <BoundaryFallback />;
    return this.props.children;
  }
}
