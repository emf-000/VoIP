"use client";

import { useEffect, useState } from "react";
import VideoCall from "@/components/VideoCall";

export default function RoomPage() {
  const [roomId, setRoomId] = useState<string>("");

  useEffect(() => {
    const path = window.location.pathname;
    const id = path.split("/room/")[1];

    if (id) {
      console.log(" Extracted roomId:", id);
      setRoomId(id);
    } else {
      console.error(" Failed to extract roomId from URL");
    }
  }, []);

  if (!roomId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading room…
      </div>
    );
  }

  return (
    <div className="p-4 bg-black min-h-screen text-white">
      <VideoCall roomId={roomId} />
    </div>
  );
}
