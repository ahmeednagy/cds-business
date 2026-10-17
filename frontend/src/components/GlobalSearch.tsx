import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ClickAwayListener,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popper,
  TextField,
} from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";

import { useAuth } from "../lib/auth";

interface SearchScope {
  key: string;
  label: string;
  icon: ReactNode;
  path: (q: string) => string;
}

/**
 * Header search — backed by real list-search endpoints only. Typing reveals
 * the scopes the term can actually be applied to; each navigates to a list
 * page that reads `?search=` and runs its own server-side query. Scopes are
 * role-gated the same way the underlying lists are.
 */
export function GlobalSearch() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const scopes: SearchScope[] = [
    {
      key: "requests",
      label: t("nav.requests"),
      icon: <AssignmentOutlinedIcon fontSize="small" />,
      path: (q) => `/requests?search=${encodeURIComponent(q)}`,
    },
    // Only HR has an employee directory with server-side search.
    ...(user?.role === "HR"
      ? [
          {
            key: "employees",
            label: t("nav.employees"),
            icon: <PeopleAltOutlinedIcon fontSize="small" />,
            path: (q: string) =>
              `/admin/employees?search=${encodeURIComponent(q)}`,
          },
        ]
      : []),
  ];

  const term = query.trim();
  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <div ref={setAnchorEl} style={{ position: "relative", width: "100%" }}>
        <TextField
          size="small"
          fullWidth
          value={query}
          placeholder={t("header.searchPlaceholder")}
          aria-label={t("common.search")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && term) go(scopes[0].path(term));
            if (e.key === "Escape") setOpen(false);
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              ),
              sx: (theme) => ({
                height: 46,
                borderRadius: "12px",
                fontSize: "0.95rem",
                bgcolor:
                  theme.palette.mode === "dark"
                    ? theme.palette.action.hover
                    : theme.palette.action.hover,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "transparent",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: theme.palette.divider,
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: theme.palette.divider,
                },
              }),
            },
          }}
        />
        <Popper
          open={open && term.length > 0}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ zIndex: (theme) => theme.zIndex.modal }}
        >
          <Paper
            sx={(theme) => ({
              mt: 0.5,
              minWidth: 300,
              border: `1px solid ${theme.palette.divider}`,
              overflow: "hidden",
            })}
          >
            <List dense disablePadding>
              {scopes.map((s) => (
                <ListItemButton
                  key={s.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(s.path(term))}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{s.icon}</ListItemIcon>
                  <ListItemText
                    primary={t("header.searchIn", { scope: s.label, term })}
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Popper>
      </div>
    </ClickAwayListener>
  );
}
