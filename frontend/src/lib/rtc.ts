/** WebRTC session for a single 1:1 call. Media flows peer-to-peer;
 * signalling is relayed through the authenticated chat WebSocket.
 * Dev uses public STUN only — real deployments need TURN (see ai_docs). */

export type CallMode = "audio" | "video";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export class RtcSession {
  pc: RTCPeerConnection;
  local: MediaStream;
  remote = new MediaStream();
  onRemoteStream: (s: MediaStream) => void = () => {};
  onIce: (c: RTCIceCandidateInit) => void = () => {};
  onStateChange: (s: RTCPeerConnectionState) => void = () => {};

  private constructor(pc: RTCPeerConnection, local: MediaStream) {
    this.pc = pc;
    this.local = local;
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => this.remote.addTrack(t));
      this.onRemoteStream(this.remote);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.onIce(e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => this.onStateChange(pc.connectionState);
  }

  static async create(mode: CallMode): Promise<RtcSession> {
    const local = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: mode === "video" ? { width: { ideal: 640 } } : false,
    });
    const pc = new RTCPeerConnection(RTC_CONFIG);
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    return new RtcSession(pc, local);
  }

  async offer() {
    const o = await this.pc.createOffer();
    await this.pc.setLocalDescription(o);
    return o;
  }

  async acceptOffer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(sdp);
    const a = await this.pc.createAnswer();
    await this.pc.setLocalDescription(a);
    return a;
  }

  async acceptAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(sdp);
  }

  async addIce(candidate: RTCIceCandidateInit) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* stale/dupe candidate — safe to drop */
    }
  }

  setMic(enabled: boolean) {
    this.local.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  setCamera(enabled: boolean) {
    this.local.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  close() {
    this.local.getTracks().forEach((t) => t.stop());
    this.pc.close();
  }
}
