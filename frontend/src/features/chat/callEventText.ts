import type { ChatMessage } from "../../types";

export interface CallEventText {
  title: string;
  subtitle: string | null;
  /** "error" for missed/cancelled/declined/failed, "success" for completed. */
  tone: "error" | "success";
  /** Callee viewing a missed/cancelled call may call back. */
  callBack: boolean;
  video: boolean;
}

export function fmtCallSeconds(total: number): string {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Translate a persisted call event into per-viewer labels.
 * `mine` = the viewer placed the call (message sender is the caller).
 */
export function callEventText(
  msg: ChatMessage,
  mine: boolean,
  peerName: string,
  t: (k: string) => string,
): CallEventText {
  const call = msg.call;
  const video = call?.mode === "video";
  const v = (a: string, b: string) => (video ? b : a);
  const base = v("voiceCall", "videoCall");
  const missed = v("missedVoice", "missedVideo");

  switch (call?.outcome) {
    case "completed":
      return {
        title: t(`chat.events.${base}`),
        subtitle: fmtCallSeconds(call.duration_seconds),
        tone: "success",
        callBack: false,
        video,
      };
    case "missed":
      return mine
        ? {
            title: t(`chat.events.${base}`),
            subtitle: t("chat.events.noAnswer"),
            tone: "error",
            callBack: false,
            video,
          }
        : {
            title: t(`chat.events.${missed}`),
            subtitle: peerName,
            tone: "error",
            callBack: true,
            video,
          };
    case "cancelled":
      return mine
        ? {
            title: t(`chat.events.${v("voiceCancelled", "videoCancelled")}`),
            subtitle: null,
            tone: "error",
            callBack: false,
            video,
          }
        : {
            // For the callee a cancelled incoming call is a missed call.
            title: t(`chat.events.${missed}`),
            subtitle: peerName,
            tone: "error",
            callBack: true,
            video,
          };
    case "declined":
      return mine
        ? {
            title: t(`chat.events.${v("voiceDeclined", "videoDeclined")}`),
            subtitle: null,
            tone: "error",
            callBack: false,
            video,
          }
        : {
            title: t(`chat.events.${v("declinedVoice", "declinedVideo")}`),
            subtitle: null,
            tone: "error",
            callBack: false,
            video,
          };
    case "failed":
    default:
      return {
        title: t(`chat.events.${v("voiceFailed", "videoFailed")}`),
        subtitle: null,
        tone: "error",
        callBack: false,
        video,
      };
  }
}

/** One-line preview for conversation lists. */
export function callEventPreview(
  msg: ChatMessage,
  mine: boolean,
  peerName: string,
  t: (k: string) => string,
): string {
  const { title, subtitle } = callEventText(msg, mine, peerName, t);
  return subtitle ? `${title} — ${subtitle}` : title;
}

/** List preview: text body, or the localized call-event summary. */
export function messagePreview(
  msg: ChatMessage | null | undefined,
  myId: number,
  peerName: string,
  t: (k: string) => string,
): string | null {
  if (!msg) return null;
  if (msg.kind === "call" && msg.call)
    return callEventPreview(msg, msg.sender === myId, peerName, t);
  return msg.body;
}
