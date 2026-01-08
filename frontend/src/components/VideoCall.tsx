"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";


const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: process.env.NEXT_PUBLIC_TURN_URL!,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME!,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL!,
    },
  ],
};


export default function VideoCall({ roomId }: { roomId: string }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const isInitiator = useRef(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const [remoteReady, setRemoteReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // ================= WEBRTC =================
  useEffect(() => {
    socket.emit("join-room", roomId);

    socket.on("role", ({ initiator }) => {
      isInitiator.current = initiator;
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStream.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;

        peer.current = new RTCPeerConnection(ICE_SERVERS);

        stream.getTracks().forEach((track) =>
          peer.current!.addTrack(track, stream)
        );

        peer.current.ontrack = (event) => {
          if (remoteVideo.current) {
            remoteVideo.current.srcObject = event.streams[0];
            setRemoteReady(true);
          }
        };

        peer.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              roomId,
              candidate: event.candidate,
            });
          }
        };
      });

    // ONLY INITIATOR CREATES OFFER
    socket.on("user-joined", async () => {
      if (!peer.current || !isInitiator.current) return;

      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    });

    socket.on("offer", async (offer) => {
      if (!peer.current) return;

      await peer.current.setRemoteDescription(offer);

      pendingCandidates.current.forEach((c) =>
        peer.current?.addIceCandidate(c)
      );
      pendingCandidates.current = [];

      const answer = await peer.current.createAnswer();
      await peer.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async (answer) => {
      if (!peer.current) return;

      await peer.current.setRemoteDescription(answer);

      pendingCandidates.current.forEach((c) =>
        peer.current?.addIceCandidate(c)
      );
      pendingCandidates.current = [];
    });

    socket.on("ice-candidate", (candidate) => {
      if (peer.current?.remoteDescription) {
        peer.current.addIceCandidate(candidate);
      } else {
        pendingCandidates.current.push(candidate);
      }
    });

    return () => {
      socket.off("role");
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      peer.current?.close();
      peer.current = null;
    };
  }, [roomId]);

  // ================= SCREEN SHARE =================
  const startScreenShare = async () => {
    if (!peer.current || !localStream.current) return;

    screenStream.current = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    const screenTrack = screenStream.current.getVideoTracks()[0];
    const sender = peer.current
      .getSenders()
      .find((s) => s.track?.kind === "video");

    sender?.replaceTrack(screenTrack);

    if (localVideo.current) localVideo.current.srcObject = screenStream.current;

    screenTrack.onended = () => {
      sender?.replaceTrack(localStream.current!.getVideoTracks()[0]);
      if (localVideo.current)
        localVideo.current.srcObject = localStream.current;
    };
  };

  // ================= RECORDING =================
  const startRecording = () => {
    if (!localStream.current || !remoteReady) return;

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    audioContext
      .createMediaStreamSource(localStream.current)
      .connect(destination);

    audioContext
      .createMediaStreamSource(remoteVideo.current!.srcObject as MediaStream)
      .connect(destination);

    const videoTrack =
      screenStream.current?.getVideoTracks()[0] ||
      localStream.current.getVideoTracks()[0];

    const finalStream = new MediaStream([
      videoTrack,
      ...destination.stream.getAudioTracks(),
    ]);

    recordedChunks.current = [];

    mediaRecorder.current = new MediaRecorder(finalStream);
    mediaRecorder.current.ondataavailable = (e) =>
      recordedChunks.current.push(e.data);

    mediaRecorder.current.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      a.click();
      setIsRecording(false);
    };

    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => mediaRecorder.current?.stop();

  // ================= UI =================
  return (
    <div className="min-h-screen bg-black text-white flex flex-col p-4">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <video ref={localVideo} autoPlay muted playsInline className="rounded" />
        <video ref={remoteVideo} autoPlay playsInline className="rounded" />
      </div>

      <div className="flex gap-3 justify-center mt-4">
        <button onClick={startScreenShare}>Share Screen</button>
        <button onClick={startRecording} disabled={!remoteReady || isRecording}>
          Start Recording
        </button>
        <button onClick={stopRecording} disabled={!isRecording}>
          Stop & Save
        </button>
      </div>
    </div>
  );
}
