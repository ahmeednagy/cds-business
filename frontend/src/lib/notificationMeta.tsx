import type { ReactNode } from "react";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import HighlightOffOutlinedIcon from "@mui/icons-material/HighlightOffOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import PhoneMissedIcon from "@mui/icons-material/PhoneMissed";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";

import type { AppNotification } from "../types";

export function itemPath(n: AppNotification): string | null {
  if (n.item_type === "request") return `/requests/${n.item_id}`;
  if (n.item_type === "timesheet") return `/timesheets/${n.item_id}`;
  if (n.item_type === "call") return "/chat";
  return null;
}

/** Semantic icon from REAL data only: the message text (server-generated
 * verbs like "approved"/"rejected"/"awaiting your review") and item_type. */
export function iconFor(n: AppNotification): { icon: ReactNode; tint: string } {
  const msg = n.message.toLowerCase();
  if (msg.includes("approved"))
    return { icon: <CheckCircleOutlineOutlinedIcon />, tint: "#16A34A" };
  if (msg.includes("rejected"))
    return { icon: <HighlightOffOutlinedIcon />, tint: "#DC2626" };
  if (msg.includes("awaiting your review") || msg.includes("pending"))
    return { icon: <PersonOutlineOutlinedIcon />, tint: "#D97706" };
  if (n.item_type === "request")
    return { icon: <DescriptionOutlinedIcon />, tint: "#2563EB" };
  if (n.item_type === "timesheet")
    return { icon: <CalendarMonthOutlinedIcon />, tint: "#2563EB" };
  if (n.item_type === "call")
    return { icon: <PhoneMissedIcon />, tint: "#DC2626" };
  if (n.item_type === "user")
    return { icon: <PersonOutlineOutlinedIcon />, tint: "#64748B" };
  return { icon: <NotificationsNoneOutlinedIcon />, tint: "#64748B" };
}
