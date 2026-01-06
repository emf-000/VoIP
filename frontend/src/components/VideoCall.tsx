"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/lib/socket";

/**
 * ✅ FOR PRESENTATION: FORCE TURN ONLY
 * (STUN removed to avoid ICE confusion)
 */
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export default function VideoCall({ roomId }: { roomId: string }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const [remoteReady, setRemoteReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // ================= WEBRTC =================
  useEffect(() => {
    socket.emit("join-room", roomId);

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

    /**
     * ✅ CREATE OFFER AFTER TRACKS ARE READY
     */
    socket.on("user-joined", async () => {
      if (!peer.current) return;

      setTimeout(async () => {
        const offer = await peer.current!.createOffer();
        await peer.current!.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer });
      }, 500);
    });

    /**
     * ✅ HANDLE OFFER
     */
    socket.on("offer", async (offer) => {
      if (!peer.current) return;

      await peer.current.setRemoteDescription(offer);

      // 🔑 APPLY QUEUED ICE CANDIDATES
      pendingCandidates.current.forEach((c) =>
        peer.current?.addIceCandidate(c)
      );
      pendingCandidates.current = [];

      const answer = await peer.current.createAnswer();
      await peer.current.setLocalDescription(answer);

      socket.emit("answer", { roomId, answer });
    });

    /**
     * ✅ HANDLE ANSWER
     */
    socket.on("answer", async (answer) => {
      if (!peer.current) return;

      await peer.current.setRemoteDescription(answer);

      // 🔑 APPLY QUEUED ICE CANDIDATES
      pendingCandidates.current.forEach((c) =>
        peer.current?.addIceCandidate(c)
      );
      pendingCandidates.current = [];
    });

    /**
     * ✅ QUEUE ICE CANDIDATES UNTIL REMOTE SDP EXISTS
     */
    socket.on("ice-candidate", (candidate) => {
      if (peer.current?.remoteDescription) {
        peer.current.addIceCandidate(candidate);
      } else {
        pendingCandidates.current.push(candidate);
      }
    });

    return () => {
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

    if (localVideo.current) {
      localVideo.current.srcObject = screenStream.current;
    }

    screenTrack.onended = () => {
      const camTrack = localStream.current!.getVideoTracks()[0];
      sender?.replaceTrack(camTrack);

      if (localVideo.current) {
        localVideo.current.srcObject = localStream.current;
      }
    };
  };

  // ================= RECORDING =================
  const startRecording = () => {
    if (!localStream.current || !remoteReady) {
      alert("Wait for other user to join");
      return;
    }

    alert("🔴 Recording started");

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    audioContext
      .createMediaStreamSource(localStream.current)
      .connect(destination);

    const remoteStream = remoteVideo.current?.srcObject as MediaStream;
    audioContext
      .createMediaStreamSource(remoteStream)
      .connect(destination);

    const videoTrack =
      screenStream.current?.getVideoTracks()[0] ||
      localStream.current.getVideoTracks()[0];

    const finalStream = new MediaStream([
      videoTrack,
      ...destination.stream.getAudioTracks(),
    ]);

    recordedChunks.current = [];

    mediaRecorder.current = new MediaRecorder(finalStream, {
      mimeType: "video/webm",
    });

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };

    mediaRecorder.current.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "call-recording.webm";
      a.click();

      setIsRecording(false);
      alert("✅ Recording saved");
    };

    mediaRecorder.current.start(1000);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
    }
  };

  // ================= UI =================
  return (
    <div className="min-h-screen bg-black text-white flex flex-col p-2 sm:p-4">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          className="w-full h-full max-h-[45vh] sm:max-h-full object-cover rounded-lg bg-black"
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className="w-full h-full max-h-[45vh] sm:max-h-full object-cover rounded-lg bg-black"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-between">
        <button
          onClick={startScreenShare}
          className="px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600"
        >
          Share Screen
        </button>

        <button
          onClick={startRecording}
          disabled={!remoteReady || isRecording}
          className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-600"
        >
          Start Recording
        </button>

        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className="px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
        >
          Stop & Save
        </button>
      </div>
    </div>
  );
}
