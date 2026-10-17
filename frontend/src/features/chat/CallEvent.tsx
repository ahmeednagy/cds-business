import { useTranslation } from "react-i18next";
import { alpha, Box, ButtonBase, Typography } from "@mui/material";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import PhoneMissedIcon from "@mui/icons-material/PhoneMissed";
import MissedVideoCallIcon from "@mui/icons-material/MissedVideoCall";

import type { ChatMessage } from "../../types";
import { callEventText } from "./callEventText";

export function CallEventMessage({
  msg,
  mine,
  peerName,
  onCallBack,
}: {
  msg: ChatMessage;
  mine: boolean;
  peerName: string;
  onCallBack?: (mode: "audio" | "video") => void;
}) {
  const { t, i18n } = useTranslation();
  const info = callEventText(msg, mine, peerName, t);
  const time = new Date(msg.created_at).toLocaleTimeString(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
  });

  const Icon = info.video
    ? info.tone === "success"
      ? VideocamOutlinedIcon
      : MissedVideoCallIcon
    : info.tone === "success"
      ? PhoneOutlinedIcon
      : PhoneMissedIcon;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", my: 1 }}>
      <Box
        sx={(theme) => ({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.25,
          px: 2.25,
          py: 0.9,
          borderRadius: "14px",
          border: `1px solid ${theme.palette.divider}`,
          bgcolor:
            info.tone === "success"
              ? alpha(theme.palette.success.main, 0.06)
              : alpha(theme.palette.error.main, 0.05),
          maxWidth: "85%",
          textAlign: "center",
        })}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            color: info.tone === "success" ? "success.main" : "error.main",
          }}
        >
          <Icon sx={{ fontSize: 17 }} />
          <Typography
            sx={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: info.tone === "success" ? "success.dark" : "error.main",
            }}
          >
            {info.title}
          </Typography>
        </Box>
        {info.subtitle && (
          <Typography sx={{ fontSize: "0.72rem" }} color="text.secondary">
            {info.subtitle}
          </Typography>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: "0.66rem" }} color="text.secondary">
            {time}
          </Typography>
          {info.callBack && onCallBack && (
            <ButtonBase
              onClick={() => onCallBack(info.video ? "video" : "audio")}
              sx={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "primary.main",
                px: 0.75,
                py: 0.15,
                borderRadius: 1,
              }}
            >
              {t("chat.events.callBack")}
            </ButtonBase>
          )}
        </Box>
      </Box>
    </Box>
  );
}
