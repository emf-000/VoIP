import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

// Local fallback ONLY for dev / LAN testing
const localFallback = isBrowser
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : "http://localhost:5000";

// Final socket URL
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (process.env.NODE_ENV === "development" ? localFallback : undefined);

if (!SOCKET_URL) {
  throw new Error(
    "NEXT_PUBLIC_SOCKET_URL is not defined. This is required in production."
  );
}

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});
