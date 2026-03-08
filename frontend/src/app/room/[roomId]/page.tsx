"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { connectSocket } from "@/lib/socket";
import VideoCall from "@/components/VideoCall";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [initiator, setInitiator] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please login first");
      return;
    }

    const socket = connectSocket(token);

    socket.on("connect", () => {
      console.log("Socket connected");
      socket.emit("join-room", roomId);
    });

    socket.on("role", ({ initiator }) => {
      console.log("ROLE RECEIVED:", initiator);
      setInitiator(initiator);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  if (initiator === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Connecting...
      </div>
    );
  }

  return <VideoCall roomId={roomId} initiator={initiator} />;
}