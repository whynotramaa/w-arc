"use client";

import { useEffect, useRef, useState } from "react";

export default function CamPage() {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [facing, setFacing] = useState<"user" | "environment">("user");

  useEffect(() => {
    let stream: MediaStream | undefined;
    let peer: import("peerjs").Peer | undefined;
    let slow: ReturnType<typeof setTimeout> | undefined;
    const room = new URLSearchParams(location.search).get("room");
    (async () => {
      if (!room) return setStatus("Missing room. Scan the QR code in the studio.");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      video.current!.srcObject = stream;
      await navigator.wakeLock?.request("screen").catch(() => {});
      const { Peer } = await import("peerjs");
      peer = new Peer();
      slow = setTimeout(() => setStatus("Can't reach the pairing server. Turn on Secure DNS and reload."), 10000);
      peer.on("open", () => {
        clearTimeout(slow);
        const pc = peer!.call(room, stream!).peerConnection;
        setStatus("Connecting to the studio…");
        pc?.addEventListener("connectionstatechange", () => {
          if (pc.connectionState === "connected") setStatus("Live. Hold the phone sideways.");
          if (pc.connectionState === "failed") setStatus("Couldn't connect. Put both devices on the same Wi-Fi.");
        });
      });
      peer.on("error", e => {
        clearTimeout(slow);
        setStatus(e.type === "peer-unavailable" ? "Studio not found. Click Phone in the studio and scan again." : e.message);
      });
    })().catch(e => setStatus((e as Error).message));
    return () => {
      clearTimeout(slow);
      peer?.destroy();
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [facing]);

  return (
    <main style={{ height: "100vh", display: "grid", placeItems: "end center", padding: 24, background: "#000", color: "#fff" }}>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />
      <div style={{ position: "relative", display: "grid", gap: 10, justifyItems: "center" }}>
        <span className="btn">{status}</span>
        <button className="btn primary" onClick={() => setFacing(f => (f === "user" ? "environment" : "user"))}>
          Switch to {facing === "user" ? "back" : "front"} camera
        </button>
      </div>
    </main>
  );
}
