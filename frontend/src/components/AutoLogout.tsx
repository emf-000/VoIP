"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function AutoLogout(): null {
  const router = useRouter();

  useEffect(() => {
    const checkSession = () => {
      const loginTime = localStorage.getItem("loginTime");

      if (!loginTime) return;

      const now = Date.now();
      const diff = now - parseInt(loginTime, 10);

      const ONE_DAY = 24 * 60 * 60 * 1000;

      if (diff > ONE_DAY) {
        const socket = getSocket();
        if (socket) socket.disconnect();

        localStorage.removeItem("token");
        localStorage.removeItem("loginTime");

        router.push("/login");
      }
    };

    checkSession();

    const interval: NodeJS.Timeout = setInterval(checkSession, 60 * 1000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}