import { io } from "socket.io-client";

const LOCAL_SOCKET = "http://localhost:5000";
const PROD_SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL;

const SOCKET_URL =
  process.env.NODE_ENV === "development"
    ? LOCAL_SOCKET
    : PROD_SOCKET;

if (!SOCKET_URL) {
  throw new Error(
    "NEXT_PUBLIC_SOCKET_URL is missing. Set it in Vercel Environment Variables."
  );
}

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
});
