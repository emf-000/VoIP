"use client";

import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    const socket = getSocket();

    if (socket) {
      socket.disconnect(); 
    }

    localStorage.removeItem("token"); 

    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white"
    >
      Logout
    </button>
  );
}