"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaConnection } from "peerjs";
import { Minus, Plus, SwitchCamera } from "lucide-react";

const RATIOS = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1 };
type Ratio = keyof typeof RATIOS;
type Zoom = { min: number; max: number; value: number };

const size = (a: number, zoom?: number) =>
  ({
    aspectRatio: a,
    width: { ideal: Math.round(a >= 1 ? 1920 : 1920 * a) },
    height: { ideal: Math.round(a >= 1 ? 1920 / a : 1920) },
    advanced: zoom === undefined ? [] : [{ zoom }],
  }) as unknown as MediaTrackConstraints;

const openCamera = (facing: string, a: number) =>
  navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, zoom: true, ...size(a) } as unknown as MediaTrackConstraints, audio: true });

export default function CamPage() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const call = useRef<MediaConnection | null>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [portrait, setPortrait] = useState(false);
  const [ratio, setRatio] = useState<Ratio>("16:9");
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const aspect = portrait ? 1 / RATIOS[ratio] : RATIOS[ratio];

  const attach = (s: MediaStream) => {
    stream.current = s;
    video.current!.srcObject = s;
    call.current?.peerConnection?.getSenders().forEach(sender => {
      const t = s.getTracks().find(t => t.kind === sender.track?.kind);
      if (t) sender.replaceTrack(t);
    });
    const track = s.getVideoTracks()[0];
    const z = (track.getCapabilities?.() as { zoom?: { min: number; max: number } }).zoom;
    setZoom(z ? { min: z.min, max: z.max, value: (track.getSettings() as { zoom?: number }).zoom ?? z.min } : null);
  };

  const apply = (a: number, z = zoom?.value) => stream.current?.getVideoTracks()[0]?.applyConstraints(size(a, z)).catch(() => {});

  useEffect(() => {
    let peer: import("peerjs").Peer | undefined;
    let slow: ReturnType<typeof setTimeout> | undefined;
    const room = new URLSearchParams(location.search).get("room");
    (async () => {
      if (!room) return setStatus("Missing room. Scan the QR code in the studio.");
      attach(await openCamera("user", RATIOS["16:9"]));
      await navigator.wakeLock?.request("screen").catch(() => {});
      const { Peer } = await import("peerjs");
      peer = new Peer();
      slow = setTimeout(() => setStatus("Can't reach the pairing server. Turn on Secure DNS and reload."), 10000);
      peer.on("open", () => {
        clearTimeout(slow);
        call.current = peer!.call(room, stream.current!);
        const pc = call.current.peerConnection;
        setStatus("Connecting to the studio…");
        pc?.addEventListener("connectionstatechange", () => {
          if (pc.connectionState === "connected") setStatus("Live");
          if (pc.connectionState === "failed") setStatus("Couldn't connect to the studio. Reload to try again.");
        });
      });
      peer.on("disconnected", () => !peer!.destroyed && peer!.reconnect());
      peer.on("error", e => {
        if (e.type === "network") return;
        clearTimeout(slow);
        setStatus(e.type === "peer-unavailable" ? "Studio not found. Click Phone in the studio and scan again." : e.message);
      });
    })().catch(e => setStatus((e as Error).message));
    return () => {
      clearTimeout(slow);
      peer?.destroy();
      stream.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const flip = async () => {
    const f = facing === "user" ? "environment" : "user";
    stream.current?.getTracks().forEach(t => t.stop());
    setFacing(f);
    attach(await openCamera(f, aspect).catch(e => (setStatus((e as Error).message), openCamera(facing, aspect))));
  };
  const pickOrientation = (p: boolean) => {
    setPortrait(p);
    apply(p ? 1 / RATIOS[ratio] : RATIOS[ratio]);
  };
  const pickRatio = (r: Ratio) => {
    setRatio(r);
    apply(portrait ? 1 / RATIOS[r] : RATIOS[r]);
  };
  const zoomBy = (d: number) => {
    if (!zoom) return;
    const value = Math.min(zoom.max, Math.max(zoom.min, Math.round((zoom.value + d) * 10) / 10));
    setZoom({ ...zoom, value });
    apply(aspect, value);
  };

  return (
    <main className="cam">
      <p className="cam-status">{status}</p>
      <div className="cam-frame" style={{ "--a": aspect } as React.CSSProperties}>
        <video ref={video} autoPlay playsInline muted style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />
      </div>
      <div className="cam-controls">
        <div className="label">Orientation</div>
        <div className="seg">
          <button aria-pressed={!portrait} onClick={() => pickOrientation(false)}>Landscape</button>
          <button aria-pressed={portrait} onClick={() => pickOrientation(true)}>Portrait</button>
        </div>
        <div className="label">Aspect ratio</div>
        <div className="seg">
          {(Object.keys(RATIOS) as Ratio[]).map(r => (
            <button key={r} aria-pressed={ratio === r} onClick={() => pickRatio(r)}>{portrait ? r.split(":").reverse().join(":") : r}</button>
          ))}
        </div>
        <div className="label">Zoom</div>
        <div className="cam-zoom">
          <button className="btn" aria-label="Zoom out" disabled={!zoom || zoom.value <= zoom.min} onClick={() => zoomBy(-0.5)}><Minus size={16} /></button>
          <span className="mono">{zoom ? `${zoom.value.toFixed(1)}×` : "Not supported"}</span>
          <button className="btn" aria-label="Zoom in" disabled={!zoom || zoom.value >= zoom.max} onClick={() => zoomBy(0.5)}><Plus size={16} /></button>
        </div>
        <button className="btn" onClick={flip}><SwitchCamera size={16} />Switch to {facing === "user" ? "back" : "front"} camera</button>
      </div>
    </main>
  );
}
