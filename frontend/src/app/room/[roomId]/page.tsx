"use client";

import { useParams } from "next/navigation";
import VideoCall from "@/components/VideoCall";

export default function Room() {
  const params = useParams();
  const roomId = params.roomId as string;

  return (
    <div className="p-4 bg-black min-h-screen text-white">
      <VideoCall roomId={roomId} />
    </div>
  );
}
