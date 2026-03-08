"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

/* ================= TURN CONFIG ================= */
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turns:global.relay.metered.ca:443?transport=tcp",
      ],
      username: "58ac160abdcfd1a2f074a5f7",
      credential: "fQjUYpyAwkshRceh",
    },
  ],
};

export default function VideoCall({
  roomId,
  initiator,
}: {
  roomId: string;
  initiator: boolean;
}) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const router = useRouter();
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const peer = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [remoteReady, setRemoteReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const isMobile =
  typeof window !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    if (!socket) return;

    /* ================= CREATE PEER ================= */
    peer.current = new RTCPeerConnection(ICE_SERVERS);

    peer.current.onnegotiationneeded = async () => {
      try {
        if (!initiator) return;

        console.log("Renegotiation triggered");

        const offer = await peer.current!.createOffer();
        await peer.current!.setLocalDescription(offer);

        socket.emit("offer", { roomId, offer });
      } catch (err) {
        console.error("Renegotiation error:", err);
      }
    };

    peer.current.ontrack = (event) => {
      console.log("REMOTE TRACK RECEIVED:", event.track.kind);

      if (!remoteVideo.current) return;

      const remoteStream =
        remoteVideo.current.srcObject instanceof MediaStream
          ? remoteVideo.current.srcObject
          : new MediaStream();

      remoteStream.addTrack(event.track);

      remoteVideo.current.srcObject = remoteStream;

      setRemoteReady(true);
    };
    peer.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

   peer.current.oniceconnectionstatechange = () => {
      const state = peer.current?.iceConnectionState;

      console.log("ICE State:", state);

      if (state === "disconnected" || state === "failed" || state === "closed") {
        console.log("Remote user disconnected");

        if (remoteVideo.current) {
          remoteVideo.current.srcObject = null;
        }

        peer.current?.close();
      }
  };

    /* ================= GET LOCAL MEDIA ================= */
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStream.current = stream;

        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => {
          peer.current!.addTrack(track, stream);
        });
      })
      .catch((err) => {
        console.error("Media error:", err);
      });
   

    /* ================= SIGNALING ================= */

    socket.on("offer", async (offer) => {
      if (!peer.current) return;

      console.log("Received offer");

      if (!localStream.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        localStream.current = stream;

        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }

        stream.getTracks().forEach((track) => {
          peer.current!.addTrack(track, stream);
        });
      }

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

          console.log("Received answer");

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

    socket.on("room-full", () => {
    alert("Room is full. Only 2 users allowed.");
    router.push("/");
  });  
    
  socket.on("user-joined", async () => {
    if (!initiator) return;

    console.log("Second user joined");

    if (!peer.current || peer.current.signalingState === "closed") {
      console.log("Recreating peer connection");

      peer.current = new RTCPeerConnection(ICE_SERVERS);

      peer.current.ontrack = (event) => {
        if (!remoteVideo.current) return;

        const remoteStream =
          remoteVideo.current.srcObject instanceof MediaStream
            ? remoteVideo.current.srcObject
            : new MediaStream();

        remoteStream.addTrack(event.track);
        remoteVideo.current.srcObject = remoteStream;
      };

      peer.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      localStream.current?.getTracks().forEach((track) => {
        peer.current!.addTrack(track, localStream.current!);
      });
    }

    const offer = await peer.current.createOffer();
    await peer.current.setLocalDescription(offer);

    socket.emit("offer", { roomId, offer });
  });

    return () => {
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-joined");
      socket.off("room-full");
      cleanupMedia();
    };
  }, [roomId, initiator]);

  /* ================= SCREEN SHARE ================= */
  const startScreenShare = async () => {
  if (!peer.current) return;

  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });

    const screenTrack = screenStream.getVideoTracks()[0];
    screenTrackRef.current = screenTrack;

    const sender = peer.current
      .getSenders()
      .find((s) => s.track && s.track.kind === "video");

    if (!sender) return;

    await sender.replaceTrack(screenTrack);

    if (localVideo.current) {
      localVideo.current.srcObject = screenStream;
    }

    console.log("Screen track replaced");

    const socket = getSocket();
    if (initiator && socket) {
      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);

      socket.emit("offer", { roomId, offer });
    }

    screenTrack.onended = async () => {
      const cameraTrack = localStream.current?.getVideoTracks()[0];
      if (!cameraTrack) return;

      await sender.replaceTrack(cameraTrack);

      if (localVideo.current) {
        localVideo.current.srcObject = localStream.current;
      }

      if (initiator && socket) {
        const offer = await peer.current!.createOffer();
        await peer.current!.setLocalDescription(offer);

        socket.emit("offer", { roomId, offer });
      }
    };
  }catch (err: any) {
    if (err.name === "NotAllowedError") {
      console.log("User denied screen sharing permission");
    } else {
      console.error("Screen share error:", err);
    }
  }
};

  /* ================= STOP SCREEN SHARING ================= */
const stopScreenShare = async () => {
  if (!peer.current || !screenTrackRef.current) return;

  const cameraTrack = localStream.current?.getVideoTracks()[0];

  const sender = peer.current
    .getSenders()
    .find((s) => s.track && s.track.kind === "video");

  if (!sender || !cameraTrack) return;

  await sender.replaceTrack(cameraTrack);

  if (localVideo.current) {
    localVideo.current.srcObject = localStream.current;
  }

  screenTrackRef.current.stop();
  screenTrackRef.current = null;

  const socket = getSocket();

  if (initiator && socket) {
    const offer = await peer.current.createOffer();
    await peer.current.setLocalDescription(offer);

    socket.emit("offer", { roomId, offer });
  }
};

  /* ================= RECORDING ================= */
  const startRecording = async () => {
    if (!remoteReady) {
      alert("Wait for other user to join");
      return;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    recordedChunks.current = [];
    mediaRecorder.current = new MediaRecorder(stream);

    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };

    mediaRecorder.current.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.webm";
      a.click();

      setIsRecording(false);
      setRecordSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    mediaRecorder.current.start();
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);

    stream.getVideoTracks()[0].onended = () => {
      mediaRecorder.current?.stop();
    };
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
  };

  const cleanupMedia = () => {
  console.log("Cleaning up media");

  if (peer.current && peer.current.connectionState !== "closed") {
    peer.current.getSenders().forEach((sender) => {
      try {
        if (sender.track) sender.replaceTrack(null);
      } catch (err) {
        console.log("replaceTrack skipped");
      }
    });
  }

  if (localStream.current) {
    localStream.current.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
    localStream.current = null;
  }

  if (screenTrackRef.current) {
    screenTrackRef.current.stop();
    screenTrackRef.current = null;
  }

  if (remoteVideo.current?.srcObject) {
    const remoteStream = remoteVideo.current.srcObject as MediaStream;
    remoteStream.getTracks().forEach((track) => track.stop());
  }

  if (localVideo.current) {
    localVideo.current.pause();
    localVideo.current.srcObject = null;
  }

  if (remoteVideo.current) {
    remoteVideo.current.pause();
    remoteVideo.current.srcObject = null;
  }

  peer.current?.close();
  peer.current = null;
  pendingCandidates.current = [];
};

const endCall = () => {
  const socket = getSocket();

  if (socket) socket.emit("leave-room", roomId);

  cleanupMedia();

  router.push("/");
};

  /* ================= UI ================= */
  return (
  <div className="min-h-screen bg-black text-white flex flex-col p-3 sm:p-4">

    {isRecording && (
      <div className="text-center text-red-500 mb-2 text-sm sm:text-base">
        ● Recording... {recordSeconds}s
      </div>
    )}

    {/* Video Container */}
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">

      <video
        ref={localVideo}
        autoPlay
        muted
        playsInline
        className="w-full h-[35vh] md:h-full bg-gray-900 rounded-lg object-cover"
      />

      <video
        ref={remoteVideo}
        autoPlay
        playsInline
        className="w-full h-[35vh] md:h-full bg-gray-900 rounded-lg object-cover"
      />

    </div>

    {/* Controls */}
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mt-4">

      {!isMobile && (
        <>
          <button
            onClick={startScreenShare}
            className="bg-blue-600 hover:bg-blue-700 px-3 sm:px-4 py-2 rounded text-sm sm:text-base"
          >
            Share Screen
          </button>

          <button
            onClick={stopScreenShare}
            className="bg-gray-700 hover:bg-gray-600 px-3 sm:px-4 py-2 rounded text-sm sm:text-base"
          >
            Stop Sharing
          </button>

          <button
            onClick={startRecording}
            disabled={!remoteReady || isRecording}
            className="bg-green-600 hover:bg-green-700 px-3 sm:px-4 py-2 rounded text-sm sm:text-base disabled:opacity-50"
          >
            {isRecording ? "Recording..." : "Start Recording"}
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className="bg-yellow-600 hover:bg-yellow-700 px-3 sm:px-4 py-2 rounded text-sm sm:text-base disabled:opacity-50"
          >
            Stop & Save
          </button>
        </>
      )}

      <button
        onClick={endCall}
        className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded text-sm sm:text-base"
      >
        End Call
      </button>
    </div>
  </div>
);
}