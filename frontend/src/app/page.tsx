"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [room, setRoom] = useState("");
  const router = useRouter();

  const joinRoom = () => {
    if (!room.trim()) return;
    router.push(`/room/${room}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <div className="w-full max-w-md bg-gray-800/80 backdrop-blur rounded-xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">
            VoIP Video Call
          </h1>
          <p className="text-gray-400 text-sm">
            Enter a room ID to start or join a call
          </p>
        </div>

        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Room ID (e.g. test123)"
          className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
        />

        <button
          onClick={joinRoom}
          disabled={!room.trim()}
          className="w-full py-3 rounded-lg font-semibold transition
                     bg-blue-600 hover:bg-blue-700
                     disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Join Call
        </button>

        <p className="text-xs text-center text-gray-400">
          Open the same Room ID on another device to connect
        </p>
      </div>
    </div>
  );
}
