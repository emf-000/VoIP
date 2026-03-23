"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket, connectSocket } from "@/lib/socket";

type ChatMessage = {
  message: string;
  senderId: string;
  senderName: string;
  createdAt: string | Date;
};

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
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
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

  const router = useRouter();
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingTextRef = useRef<HTMLDivElement | null>(null);
  const candidateQueue = useRef<{ [key: string]: RTCIceCandidateInit[] }>({});
  const peers = useRef<{ [key: string]: RTCPeerConnection }>({});
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [showChat, setShowChat] = useState<boolean>(false);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const createPeer = (userId: string, socket: any) => {
    if (peers.current[userId]) {
      return peers.current[userId];
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.current[userId] = pc;

    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== "stable") return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", {
        offer: pc.localDescription,
        to: userId,
    });
};

    pc.onconnectionstatechange = () => {
  if (
    pc.connectionState === "disconnected" ||
    pc.connectionState === "failed" ||
    pc.connectionState === "closed"
  ) {
    console.log("Peer disconnected:", userId);

    pc.close();
    delete peers.current[userId];

    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  }
};

    if (pc.getSenders().length === 0) {
      localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current!);
  });
}

  pc.ontrack = (event) => {
    const stream = event.streams[0];
      setRemoteStreams((prev) => {
        if (prev[userId]) return prev;

        return {
          ...prev,
          [userId]: stream,
        };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: userId,
        });
      }
    };

    return pc;
  };

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const isMobile =
  typeof window !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      connectSocket(token)
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    if (!socket) return;

    socket.on("connect", () => {
      setUserId(socket.id);
    });

    socket.on("all-users", (users: string[]) => {
      users.forEach((id) => {
        createPeer(id, socket);
      });
    });

  const init = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localStream.current = stream;
    if (localVideo.current) {
      localVideo.current.srcObject = stream;
    }
    socket.emit("join-room", roomId);
  };
  init();
   
    /* ================= SIGNALING ================= */
  socket.on("offer", async ({ offer, from }) => {
    console.log("Received offer from:", from);
    const pc = createPeer(from, socket);
    if (!localStream.current) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      if (pc.getSenders().length === 0) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }
    }

      if (pc.signalingState !== "stable") {
        console.log("Skipping offer, state:", pc.signalingState);
       return;
      }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

  if (candidateQueue.current[from]) {
    for (const candidate of candidateQueue.current[from]) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    candidateQueue.current[from] = [];
  }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", {
      answer,
      to: from,
    });

  });

  socket.on("answer", async ({ answer, from }) => {
    console.log("Received answer from:", from);
    const pc = peers.current[from];
    if (!pc) return;
    if (pc.signalingState !== "have-local-offer") {
      console.log("Skipping answer, state:", pc.signalingState);
      return;
    }

  await pc.setRemoteDescription(new RTCSessionDescription(answer));
    if (candidateQueue.current[from]) {
      for (const candidate of candidateQueue.current[from]) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      candidateQueue.current[from] = [];
    }
  });

  socket.on("ice-candidate", ({ candidate, from }) => {

    const pc = peers.current[from];
    if (!pc) return;

    if (pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {

      if (!candidateQueue.current[from]) {
        candidateQueue.current[from] = [];
      }
      candidateQueue.current[from].push(candidate);
    }
  });

  socket.on("room-full", () => {
    alert("Room is full. Only 4 users allowed.");
    router.push("/");
  });

  socket.on("user-joined", ({ userId }) => {
    console.log("New user to connect with:", userId);
    createPeer(userId, socket);
  });

  socket.on("user-left", ({ userId }) => {
    console.log("User left:", userId);
    const pc = peers.current[userId];
    if (pc) {
      pc.close();
      delete peers.current[userId];
    }
    delete candidateQueue.current[userId];
    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  });

socket.on("receive-message", (msg: ChatMessage) => {
  setMessages((prev) => [...prev, msg]);
  const socket = getSocket();
  if (socket && msg.senderId !== socket.id && !showChat) {
    setHasNewMessage(true);
  }
});


  return () => {
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
    socket.off("user-joined");
    socket.off("all-users");
    socket.off("room-full");
    socket.off("user-left");
    socket.off("receive-message");

    cleanupMedia();
  };
  }, [roomId, initiator]);

  useEffect(() => {
    if (showChat) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView();
      }, 100);
    }
  }, [messages, showChat]);

  useEffect(() => {
  if (!localStream.current) return;
  if (localVideo.current) {
    localVideo.current.srcObject = localStream.current;
  }
}, [localStream.current]);

useEffect(() => {
  if (localVideo.current && localStream.current) {
    localVideo.current.srcObject = localStream.current;
  }
}, [remoteStreams]);

  /* ================= RECORDING ================= */
const startRecording = async () => {
  try {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const draw = () => {
      if (!ctx) return;

      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const videos = document.querySelectorAll("video");

      const cols = 2;
      const rows = Math.ceil(videos.length / cols);

      const w = canvas.width / cols;
      const h = canvas.height / rows;

      videos.forEach((video: any, i) => {
        const x = (i % cols) * w;
        const y = Math.floor(i / cols) * h;

        try {
          ctx.drawImage(video, x, y, w, h);
        } catch {}
      });

      requestAnimationFrame(draw);
    };

    draw();

    const stream = canvas.captureStream(30);

    recordedChunks.current = [];

    mediaRecorder.current = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9"
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
    };

    mediaRecorder.current.start();

    setIsRecording(true);

    let seconds = 0;

    timerRef.current = setInterval(() => {
      seconds++;

      if (recordingTextRef.current) {
        recordingTextRef.current.textContent = `● Recording... ${seconds}s`;
      }
    }, 1000);

  } catch (err) {
    console.error(err);
  }
};

const stopRecording = () => {
  mediaRecorder.current?.stop();

  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  if (recordingTextRef.current) {
    recordingTextRef.current.textContent = "● Recording... 0s";
  }

  setIsRecording(false);
};

const cleanupMedia = () => {
  console.log("Cleaning up media");

  if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
    mediaRecorder.current.stop();
  }

  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  Object.values(peers.current).forEach((pc) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    pc.close();
  });

  peers.current = {};

  if (localStream.current) {
    localStream.current.getTracks().forEach((track) => track.stop());
    localStream.current = null;
  }

  if (screenTrackRef.current) {
    screenTrackRef.current.stop();
    screenTrackRef.current = null;
  }

  if (localVideo.current) {
    localVideo.current.pause();
    localVideo.current.srcObject = null;
  }

  setRemoteStreams({});
};

const endCall = () => {
  const socket = getSocket();

  cleanupMedia();

  setTimeout(() => {
    router.push("/");
  }, 100);
};

const sendMessage = () => {
  if (!input.trim()) return;

  const socket = getSocket();
  if (!socket) return;

  socket.emit("send-message", {
    roomId,
    message: input,
  });

  setInput("");
};

  /* ================= UI ================= */
return (
  <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden">

    {/*  Recording Indicator */}
    {isRecording && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 px-4 py-1 rounded-full text-sm z-50 shadow animate-pulse">
        ● Recording...
      </div>
    )}

    {/*  VIDEO AREA */}
    <div className="flex-1 flex justify-center items-center p-2 sm:p-4 overflow-hidden">

      {Object.keys(remoteStreams).length === 0 && (
        <div className="w-full max-w-5xl">
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="w-full h-full max-h-[75vh] aspect-video bg-gray-900 rounded-2xl object-cover shadow-2xl"
          />
        </div>
      )}

      {Object.keys(remoteStreams).length === 1 && (
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 gap-4">

          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video bg-gray-900 rounded-xl object-cover"
          />

          {Object.entries(remoteStreams).map(([id, stream]) => (
            <video
              key={id}
              autoPlay
              playsInline
              ref={(video) => {
              if (!video) return;
              videoRefs.current[id] = video;
              if (!video.srcObject) {
                video.srcObject = stream;
              }
            }}
              className="w-full aspect-video bg-gray-900 rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      {Object.keys(remoteStreams).length >= 2 && (
        <div className="
          w-full max-w-7xl grid gap-4
          grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
        ">

          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video bg-gray-900 rounded-xl object-cover"
          />

          {Object.entries(remoteStreams).map(([id, stream]) => (
            <video
              key={id}
              autoPlay
              playsInline
              ref={(video) => {
              if (!video) return;
              videoRefs.current[id] = video;
              if (!video.srcObject) {
                video.srcObject = stream;
              }
            }}
              className="w-full aspect-video bg-gray-900 rounded-xl object-cover"
            />
          ))}
        </div>
      )}
    </div>

    {/* CONTROLS (Zoom Style Bottom Bar) */}
    <div className="bg-black/80 backdrop-blur border-t border-gray-800 px-4 py-3 flex justify-between items-center">

      {/* Left */}
      <div className="text-sm text-gray-400">
        Video Call
      </div>

      {/* Center Controls */}
      <div className="flex items-center gap-3">

        {!isMobile && (
          <>
            <button
              onClick={startRecording}
              disabled={Object.keys(remoteStreams).length === 0 || isRecording}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full text-sm disabled:opacity-50"
            >
              {isRecording ? "Recording..." : "Record"}
            </button>

            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded-full text-sm disabled:opacity-50"
            >
              Stop
            </button>
          </>
        )}

        <div className="relative">
          <button
            onClick={() => {
              setShowChat((prev) => {
                const newState = !prev;
                if (newState) setHasNewMessage(false);
                return newState;
              });
            }}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm"
          >
            Chat
          </button>

          {/* Notification Dot */}
          {hasNewMessage && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
          )}
        </div>

        <button
          onClick={endCall}
          className="bg-red-600 hover:bg-red-700 px-5 py-2 rounded-full text-sm font-semibold"
        >
          End
        </button>
      </div>

      {/* Right */}
      <div />
    </div>

    {/* CHAT (BOTTOM SHEET LIKE ZOOM MOBILE) */}
    {showChat && (
      <div className="
        fixed bottom-0 left-0 w-full h-[45%]
        bg-gray-950 text-white flex flex-col
        border-t border-gray-800 z-50 rounded-t-2xl
      ">

        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b border-gray-800">
          <span className="font-semibold">Chat</span>
          <button
            onClick={() => setShowChat(false)}
            className="text-gray-400 hover:text-red-400"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 pr-1 scrollbar-hide bg-gray-950">
          {messages.map((msg, i) => {
            const isMe = msg.senderId === userId;

            return (
              <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`
                    max-w-[75%] px-4 py-2 rounded-2xl text-sm
                    ${isMe
                      ? "bg-blue-600 rounded-br-none"
                      : "bg-gray-800 rounded-bl-none"}
                  `}
                >
                  {!isMe && (
                    <div className="text-xs text-green-400 mb-1">
                      {msg.senderName}
                    </div>
                  )}
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 p-3 border-t border-gray-800">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 px-4 py-2 rounded-full bg-black border border-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Type a message..."
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full text-sm"
          >
            Send
          </button>
        </div>
      </div>
    )}

    {/* Hidden Canvas */}
    <canvas ref={canvasRef} width={1920} height={1080} className="hidden" />
  </div>
);
}