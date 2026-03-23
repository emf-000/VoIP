import { io, Socket } from "socket.io-client";

const LOCAL_SOCKET = "http://localhost:5000";
const PROD_SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL;

const SOCKET_URL =
  process.env.NODE_ENV === "development"
    ? LOCAL_SOCKET
    : PROD_SOCKET;

if (!SOCKET_URL) {
  throw new Error("Socket URL missing");
}

let socket: Socket | null = null;

export const connectSocket = (token: string) => {
  if (!token) {
    console.error("Socket connection failed: token missing");
    return null;
  }

  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {token},
  });

  socket.on("connect_error", (err) => {
    console.error("Socket error:", err.message);
  });

  return socket;
};

export const getSocket = () => socket;