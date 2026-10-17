import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  alpha,
  Avatar,
  Box,
  IconButton,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import PhoneIcon from "@mui/icons-material/Phone";

import { ChatAvatar } from "../../components/ChatAvatar";
import { displayName } from "../../lib/chatFormat";
import { useChat } from "./context";

function fmtDuration(startedAt?: number) {
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function Timer({ startedAt }: { startedAt?: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((v) => v + 1), 1000);
    return () => clearInterval(i);
  }, []);
  return <>{fmtDuration(startedAt)}</>;
}

function ControlButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <IconButton
        onClick={onClick}
        aria-label={label}
        sx={{
          width: 52,
          height: 52,
          bgcolor: active ? alpha("#fff", 0.35) : alpha("#fff", 0.12),
          color: "#fff",
          "&:hover": { bgcolor: alpha("#fff", 0.25) },
        }}
      >
        {children}
      </IconButton>
      <Typography sx={{ fontSize: "0.62rem", color: alpha("#fff", 0.8) }}>
        {label}
      </Typography>
    </Box>
  );
}

export function CallOverlay() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { call, acceptCall, declineCall, endCall, toggleMic, toggleCamera } =
    useChat();
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteRef.current && call?.remoteStream)
      remoteRef.current.srcObject = call.remoteStream;
  }, [call?.remoteStream, call?.status]);
  useEffect(() => {
    if (localRef.current && call?.localStream)
      localRef.current.srcObject = call.localStream;
  }, [call?.localStream, call?.status]);

  if (!call) return null;

  const name = displayName(call.peer);
  const errorLabel = call.error
    ? t(`chat.call.${call.error}`, { defaultValue: call.error })
    : null;

  const inCall = call.status === "connecting" || call.status === "active";

  const controls = (
    <Box sx={{ display: "flex", justifyContent: "center", gap: 2, py: 2.5 }}>
      {call.status === "incoming" ? (
        <>
          <ControlButton onClick={declineCall} label={t("chat.decline")}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                bgcolor: "#E31E24",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                m: -3.5,
              }}
            >
              <CallEndIcon />
            </Box>
          </ControlButton>
          <ControlButton onClick={acceptCall} label={t("chat.accept")}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                bgcolor: "#22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                m: -3.5,
              }}
            >
              <PhoneIcon />
            </Box>
          </ControlButton>
        </>
      ) : (
        <>
          <ControlButton onClick={toggleMic} label={t("chat.mic")} active={!call.muted}>
            {call.muted ? <MicOffIcon /> : <MicIcon />}
          </ControlButton>
          <ControlButton onClick={endCall} label={t("chat.endCall")}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                bgcolor: "#E31E24",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                m: -3.5,
              }}
            >
              <CallEndIcon />
            </Box>
          </ControlButton>
          {call.mode === "video" && (
            <ControlButton
              onClick={toggleCamera}
              label={t("chat.camera")}
              active={!call.cameraOff}
            >
              {call.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
            </ControlButton>
          )}
        </>
      )}
    </Box>
  );

  const statusLine =
    call.status === "outgoing"
      ? errorLabel ?? t("chat.calling")
      : call.status === "incoming"
        ? call.mode === "video"
          ? t("chat.incomingVideo")
          : t("chat.incomingVoice")
        : call.status === "connecting"
          ? errorLabel ?? t("chat.connecting")
          : errorLabel ?? "";

  const showVideo = call.mode === "video" && inCall;

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        bottom: isMobile ? 0 : 20,
        insetInlineEnd: isMobile ? 0 : 24,
        zIndex: theme.zIndex.modal + 2,
        width: isMobile ? "100vw" : 380,
        height: isMobile ? "100dvh" : showVideo ? 480 : 430,
        borderRadius: isMobile ? 0 : "16px",
        overflow: "hidden",
        bgcolor: "#101418",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 56px rgba(0,0,0,0.5)",
      }}
    >
      {/* Title bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.25,
          bgcolor: "rgba(255,255,255,0.04)",
        }}
      >
        <ChatAvatar user={call.peer} size={26} />
        <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, flex: 1 }} noWrap>
          {name}
        </Typography>
        <IconButton
          size="small"
          onClick={endCall}
          aria-label={t("common.close")}
          sx={{ color: "#fff" }}
        >
          <CallEndIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        {showVideo ? (
          <>
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
            />
            {call.localStream && (
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  top: 12,
                  insetInlineEnd: 12,
                  width: 96,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "#000",
                }}
              />
            )}
          </>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
            }}
          >
            <Avatar
              sx={{
                width: 96,
                height: 96,
                fontSize: "2rem",
                fontWeight: 700,
                bgcolor: "primary.main",
                boxShadow: `0 0 0 10px ${alpha("#fff", 0.06)}, 0 0 0 20px ${alpha("#fff", 0.03)}`,
              }}
            >
              {name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </Avatar>
            <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {name}
            </Typography>
            <Typography sx={{ fontSize: "0.85rem", color: alpha("#fff", 0.75) }}>
              {call.status === "active" || call.status === "connecting" ? (
                <Timer startedAt={call.startedAt} />
              ) : (
                statusLine
              )}
            </Typography>
            {(call.status === "connecting" || call.status === "active") &&
              statusLine && (
                <Typography sx={{ fontSize: "0.75rem", color: alpha("#fff", 0.6) }}>
                  {statusLine}
                </Typography>
              )}
          </Box>
        )}
        {/* Hidden audio element for voice calls remote stream */}
        {call.mode === "audio" && call.remoteStream && (
          <video ref={remoteRef} autoPlay style={{ display: "none" }} />
        )}
        {call.mode === "video" && !showVideo && call.localStream === null && null}
      </Box>

      {controls}
    </Paper>
  );
}
