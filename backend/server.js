import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import Call from "./models/Call.js";

const app = express();
const allowedOrigins = process.env.FRONTEND_URL;

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));


app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/call", callRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.user.id);
  userSocketMap[socket.user.id] = socket.id;
  
   socket.on("send-message", ({ roomId, message }) => {
    if (!roomId || !message) return;

    io.to(roomId).emit("receive-message", {
      message,
      senderId: socket.id,
      senderName: socket.user.name || "User",
      createdAt: new Date(),
    });
  });

  socket.on("join-room", async (roomId) => {
    if (!roomId) return;

    socket.join(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    const users = room ? [...room] : [];

    const otherUsers = users.filter((id) => id !== socket.id);
    socket.emit("all-users", otherUsers);

    let call = await Call.findOne({ roomId, endedAt: null });

    if (!call) {
      call = await Call.create({
        roomId,
        users: [socket.user.id],
        startedAt: new Date(),
      });
    } else {
      const alreadyJoined = call.users.some(
        (u) => u.toString() === socket.user.id
      );

      if (!alreadyJoined) {
        call.users.push(socket.user.id);
        await call.save();
      }
    }

    if (users.length > 4) {
      console.log("Room full:", roomId);
      socket.emit("room-full");
      socket.leave(roomId);
      return;
    }

    console.log(`User ${socket.user.id} joined room ${roomId}`);

    if (users.length === 1) {
      socket.emit("role", { initiator: true });
    } else {
      socket.emit("role", { initiator: false });

      socket.to(roomId).emit("user-joined", {
        userId: socket.user.id,
      });
    }
  });

socket.on("leave-room", async (roomId) => {
  socket.leave(roomId);
  const room = io.sockets.adapter.rooms.get(roomId);
  const remainingCount = room ? room.size : 0;
  if (remainingCount === 0) {
    await Call.findOneAndUpdate(
      { roomId, endedAt: null },
      { endedAt: new Date() }
    );
  }
  if (remainingCount === 1) {
    const remainingUser = [...room][0];
    io.to(remainingUser).emit("role", { initiator: true });
  }
  socket.to(roomId).emit("user-left", {
    userId: socket.user.id,
  });
});

  socket.on("offer", ({ offer, to }) => {
    const socketId = userSocketMap[to];
    if (!socketId) return;
    socket.to(socketId).emit("offer", {
      offer,
      from: socket.user.id,
    });
  });

  socket.on("answer", ({ answer, to }) => {
    const socketId = userSocketMap[to];
    if (!socketId) return;
    socket.to(socketId).emit("answer", {
      answer,
      from: socket.user.id,
    });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    const socketId = userSocketMap[to];
    if (!socketId) return;

    socket.to(socketId).emit("ice-candidate", {
      candidate,
      from: socket.user.id,
    });
  });

 socket.on("disconnecting", async () => {
  for (const roomId of socket.rooms) {
    if (roomId !== socket.id) {
      const room = io.sockets.adapter.rooms.get(roomId);
      const remainingCount = room ? room.size - 1 : 0;
      if (remainingCount === 0) {
        await Call.findOneAndUpdate(
          { roomId, endedAt: null },
          { endedAt: new Date() }
        );
      }
      socket.to(roomId).emit("user-left", {
        userId: socket.user.id,
      });
    }
  }
});

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.user?.id);
    delete userSocketMap[socket.user?.id];
  });
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  await connectDB();
  console.log("Server running on port", PORT);
});
