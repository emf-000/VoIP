"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setUser(data));
      
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/call/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setCalls(data));
  }, []);

  if (!user) return <div className="text-white p-6">Loading...</div>;

  const deleteCall = async (id: string) => {
    const token = localStorage.getItem("token");
    if (!confirm("Delete this call history?")) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/call/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setCalls((prev) => prev.filter((call) => call._id !== id));
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 sm:px-6">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-2xl font-bold">Dashboard</h1>

          <button
            onClick={() => (window.location.href = "/")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
          >
            Start Call
          </button>
        </div>

        {/* USER PROFILE */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">User Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            <div className="bg-gray-900 p-4 rounded">
              <p className="text-gray-400 text-sm">Name</p>
              <p className="font-semibold">{user.name}</p>
            </div>

            <div className="bg-gray-900 p-4 rounded">
              <p className="text-gray-400 text-sm">Email</p>
              <p className="font-semibold break-words">{user.email}</p>
            </div>

            <div className="bg-gray-900 p-4 rounded">
              <p className="text-gray-400 text-sm">Joined</p>
              <p className="font-semibold">
                {new Date(user.createdAt).toDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* CALL HISTORY */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Calls</h2>
          {calls.length === 0 && (
            <p className="text-gray-400">No calls yet</p>
          )}

          {calls.map((call: any) => {

            const start = new Date(call.startedAt);
            const end = call.endedAt ? new Date(call.endedAt) : null;

            return (
              <div
                key={call._id}
                className="bg-gray-800 p-4 rounded-lg flex flex-col 
                md:flex-row md:items-center md:justify-between gap-4"
              >

                {/* CALL INFO */}
                <div className="text-gray-300 space-y-1">
                  <p><b>Room:</b> {call.roomId}</p>
                  <p><b>Started:</b> {start.toLocaleString()}</p>
                  <p><b>Ended:</b> {end ? end.toLocaleString() : "Active"}</p>
                </div>

                {/* BUTTONS */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => (window.location.href = `/room/${call.roomId}`)}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                  >
                    Join
                  </button>

                  <button
                    onClick={() => deleteCall(call._id)}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}