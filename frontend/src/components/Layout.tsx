import { useState, type ReactNode } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
  Link as RouterLink,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import { useAuth } from "../lib/auth";
import { ChatProvider } from "../features/chat/ChatProvider";
import { ChatWindow } from "../features/chat/ChatWindow";
import { CallOverlay } from "../features/chat/CallOverlay";
import { ChatBell } from "./ChatBell";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { LanguageMenu, ThemeToggle } from "./switchers";
import { LogoLockup, RoleBadge } from "./ui";

const HEADER_H = 72;
/** Reference sidebar: permanently expanded on desktop (~234px scaled). */
const SIDEBAR_W = 234;
const DRAWER_WIDTH = 252;

interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  end?: boolean;
}

function Brand() {
  const { t } = useTranslation();
  return (
    <Box
      component={RouterLink}
      to="/"
      aria-label={t("app.name")}
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 0.6,
        textDecoration: "none",
        mr: { sm: 2 },
        flexShrink: 0,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: "1.45rem",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "primary.main",
          lineHeight: 1,
        }}
      >
        {t("app.name")}
      </Typography>
      <Typography
        component="span"
        sx={{
          fontSize: "1.45rem",
          fontWeight: 650,
          letterSpacing: "-0.01em",
          color: "text.primary",
          lineHeight: 1,
        }}
      >
        {t("app.subtitle")}
      </Typography>
    </Box>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!user) return null;

  const name =
    [user.profile?.first_name, user.profile?.last_name]
      .filter(Boolean)
      .join(" ") || user.email;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <Tooltip title={t("nav.account")}>
        <ButtonBase
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={t("nav.account")}
          aria-haspopup="menu"
          sx={(theme) => ({
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            borderRadius: 2,
            px: 0.75,
            py: 0.5,
            ms: 0.5,
            "&:hover": { bgcolor: theme.palette.action.hover },
          })}
        >
          <Avatar
            sx={{
              width: 46,
              height: 46,
              fontSize: "1rem",
              fontWeight: 700,
              bgcolor: "primary.main",
            }}
          >
            {initials}
          </Avatar>
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              textAlign: "start",
              lineHeight: 1.15,
            }}
          >
            <Typography
              sx={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.25 }}
              noWrap
            >
              {name}
            </Typography>
            <Typography
              sx={{ fontSize: "0.85rem", lineHeight: 1.3 }}
              color="text.secondary"
              noWrap
            >
              {t(`role.${user.role}`, { defaultValue: user.role })}
            </Typography>
          </Box>
          <KeyboardArrowDownIcon
            fontSize="small"
            sx={{ color: "text.secondary", display: { xs: "none", md: "block" } }}
          />
        </ButtonBase>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1.5, minWidth: 200 }}>
          <Typography variant="subtitle2" noWrap>
            {name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            display="block"
          >
            {user.email}
          </Typography>
          <Box sx={{ mt: 0.75 }}>
            <RoleBadge role={user.role} />
          </Box>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate("/profile");
          }}
        >
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          {t("nav.profile")}
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setAnchor(null);
            await logout();
            navigate("/login");
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {t("nav.signOut")}
        </MenuItem>
      </Menu>
    </>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const [mobileOpen, setMobileOpen] = useState(false);
  // Hamburger collapses the desktop sidebar; below lg it opens the drawer.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarVisible = !sidebarCollapsed;

  if (!user) return null;

  const items: NavItem[] = [
    {
      to: "/",
      labelKey: "nav.dashboard",
      icon: <HomeOutlinedIcon />,
      end: true,
    },
    {
      to: "/attendance",
      labelKey: "nav.attendance",
      icon: <AccessTimeOutlinedIcon />,
    },
    {
      to: "/timesheets",
      labelKey: "nav.timesheets",
      icon: <EventNoteOutlinedIcon />,
    },
    {
      to: "/requests",
      labelKey: "nav.requests",
      icon: <AssignmentOutlinedIcon />,
    },
    // Employees — Manager sees direct reports, HR sees the full directory.
    ...(user.role === "MANAGER"
      ? [
          {
            to: "/team",
            labelKey: "nav.employees",
            icon: <PeopleAltOutlinedIcon />,
          },
        ]
      : user.role === "HR"
        ? [
            {
              to: "/admin/employees",
              labelKey: "nav.employees",
              icon: <PeopleAltOutlinedIcon />,
            },
          ]
        : []),
    {
      to: "/reports",
      labelKey: "nav.reports",
      icon: <BarChartOutlinedIcon />,
    },
    {
      to: "/profile",
      labelKey: "nav.settings",
      icon: <SettingsOutlinedIcon />,
    },
  ];

  const navList = (
    <List sx={{ px: "10px", pt: "15px" }}>
      {items.map((item) => (
        <ListItemButton
          key={item.to}
          component={NavLink}
          to={item.to}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          sx={(theme) => ({
            position: "relative",
            mb: "7px",
            borderRadius: "12px",
            px: "18px",
            minHeight: 50,
            color: theme.palette.text.primary,
            transition: "background-color 120ms ease, color 120ms ease",
            "&:hover": { bgcolor: theme.palette.action.hover },
            "& .MuiListItemIcon-root": {
              minWidth: 42,
              color: theme.palette.text.secondary,
              transition: "color 120ms ease",
              "& .MuiSvgIcon-root": { fontSize: 24 },
            },
            "&.active": {
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              boxShadow: "0 6px 14px rgba(227,30,36,0.28)",
              "& .MuiListItemIcon-root": {
                color: theme.palette.primary.contrastText,
              },
              "&:hover": { bgcolor: theme.palette.primary.dark },
            },
          })}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText
            primary={t(item.labelKey)}
            primaryTypographyProps={{
              fontSize: "1.05rem",
              fontWeight: 600,
            }}
          />
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <ChatProvider>
    <Box sx={{ minHeight: "100vh" }}>
      {/* Full-width header — sits above the sidebar like the reference. */}
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={(theme) => ({
          zIndex: theme.zIndex.drawer + 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: "background.paper",
          color: "text.primary",
        })}
      >
        <Toolbar sx={{ minHeight: HEADER_H, height: HEADER_H, px: { xs: 1.5, md: 2.5 }, gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() =>
              isDesktop ? setSidebarCollapsed((c) => !c) : setMobileOpen(true)
            }
            aria-label={t("nav.openMenu")}
            sx={{ me: 0.5 }}
          >
            <MenuIcon />
          </IconButton>
          <Brand />
          {/* Reference geometry: search sits ~26% in, ~31% of viewport wide. */}
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              flexGrow: 1,
            }}
          >
            <Box
              sx={{
                maxWidth: 590,
                ml: { md: "4%", lg: "9%", xl: "224px" },
              }}
            >
              <GlobalSearch />
            </Box>
          </Box>
          <ThemeToggle />
          <LanguageMenu />
          <ChatBell />
          <NotificationBell />
          <UserMenu />
        </Toolbar>
      </AppBar>

      {/* Mobile/tablet drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={(theme) => ({
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderInlineEnd: `1px solid ${theme.palette.divider}`,
            boxShadow: "0 0 24px rgba(16,18,20,0.10)",
            overflowY: "auto",
          },
        })}
      >
        <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
          <LogoLockup height={32} />
        </Box>
        {navList}
      </Drawer>

      {/* Permanent expanded desktop sidebar — starts under the header. */}
      <Box
        component="nav"
        aria-label={t("nav.openMenu")}
        sx={(theme) => ({
          display: { xs: "none", lg: "flex" },
          flexDirection: "column",
          position: "fixed",
          top: HEADER_H,
          bottom: 0,
          insetInlineStart: 0,
          width: sidebarVisible ? SIDEBAR_W : 0,
          bgcolor: "background.paper",
          borderInlineEnd: `1px solid ${theme.palette.divider}`,
          zIndex: theme.zIndex.drawer,
          overflowX: "hidden",
          overflowY: "auto",
          "@media (prefers-reduced-motion: no-preference)": {
            transition: "width 200ms ease",
          },
        })}
      >
        <Box sx={{ width: SIDEBAR_W, flexShrink: 0 }}>{navList}</Box>
      </Box>

      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          minWidth: 0,
          pt: `${HEADER_H}px`,
          // String value — numeric margins are interpreted as spacing×8.
          marginInlineStart: { lg: sidebarVisible ? `${SIDEBAR_W}px` : 0 },
          "@media (prefers-reduced-motion: no-preference)": {
            transition: "margin-inline-start 200ms ease",
          },
          bgcolor: "background.default",
        }}
      >
        <Box
          sx={{
            width: "100%",
            px: { xs: 2, lg: 3 },
            pt: { xs: 2, lg: "18px" },
            pb: { xs: 2, lg: "14px" },
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Floating chat window + call overlay — above content, page untouched. */}
      <ChatWindow />
      <CallOverlay />
    </Box>
    </ChatProvider>
  );
}
