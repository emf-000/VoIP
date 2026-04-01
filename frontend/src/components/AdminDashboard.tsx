"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // 👑 Get all users
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
        else setUsers([]);
      });

    // 👤 Get current admin profile
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setCurrentUser(data));

    // 📞 Get all call history
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/call/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setCalls(data));
  }, []);

  const deleteUser = async (id: string) => {
    const token = localStorage.getItem("token");

    if (!confirm("Delete this user?")) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    setUsers(prev => prev.filter(u => u._id !== id));
  };

  const deleteCall = async (id: string) => {
    const token = localStorage.getItem("token");

    if (!confirm("Delete this call?")) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/call/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    setCalls(prev => prev.filter(c => c._id !== id));
  };

  if (!currentUser) {
    return <div className="text-white p-6">Loading...</div>;
  }

return (
  <div className="min-h-screen bg-black text-white px-3 sm:px-6 py-6">
    <div className="max-w-6xl mx-auto space-y-8">

      {/* 👑 ADMIN PROFILE */}
      <div className="bg-gray-800 p-4 sm:p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Admin Profile</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-900 p-4 rounded">
            <p className="text-gray-400 text-sm">Name</p>
            <p className="font-semibold break-words">{currentUser.name}</p>
          </div>

          <div className="bg-gray-900 p-4 rounded">
            <p className="text-gray-400 text-sm">Email</p>
            <p className="font-semibold break-words">{currentUser.email}</p>
          </div>

          <div className="bg-gray-900 p-4 rounded">
            <p className="text-gray-400 text-sm">Joined</p>
            <p className="font-semibold">
              {new Date(currentUser.createdAt).toDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* 👥 USERS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">All Users</h2>

        {users.map(user => (
          <div
            key={user._id}
            className="bg-gray-800 p-4 rounded flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3"
          >
            <div className="w-full">
              <p className="font-semibold break-words">
                {user.name}
                {currentUser._id === user._id && (
                  <span className="text-xs text-gray-400 ml-2">(You)</span>
                )}
              </p>
              <p className="text-sm text-gray-400 break-words">
                {user.email}
              </p>
            </div>

            {currentUser._id !== user._id && (
              <button
                onClick={() => deleteUser(user._id)}
                className="bg-red-600 px-3 py-1 rounded w-full sm:w-auto"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 📞 CALLS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">All Calls</h2>

        {calls.length === 0 && (
          <p className="text-gray-400">No calls yet</p>
        )}

        {calls.map(call => {
          const start = new Date(call.startedAt);
          const end = call.endedAt ? new Date(call.endedAt) : null;

          return (
            <div
              key={call._id}
              className="bg-gray-800 p-4 rounded flex flex-col lg:flex-row lg:justify-between gap-4"
            >
              <div className="space-y-1 text-sm sm:text-base">
                <p><b>Room:</b> {call.roomId}</p>
                <p><b>Started:</b> {start.toLocaleString()}</p>
                <p><b>Ended:</b> {end ? end.toLocaleString() : "Active"}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <button
                  onClick={() => (window.location.href = `/room/${call.roomId}`)}
                  className="bg-blue-600 px-3 py-1 rounded w-full sm:w-auto"
                >
                  Join
                </button>

                <button
                  onClick={() => deleteCall(call._id)}
                  className="bg-red-600 px-3 py-1 rounded w-full sm:w-auto"
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