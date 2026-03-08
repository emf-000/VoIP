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
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
  });

  return socket;
};

export const getSocket = () => socket;