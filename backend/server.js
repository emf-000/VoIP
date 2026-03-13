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
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/call", callRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },

});

/* SOCKET AUTH MIDDLEWARE */
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

/* SOCKET CONNECTION */
io.on("connection", (socket) => {
  console.log("User connected:", socket.user.id);

socket.on("join-room", async (roomId) => {
  if (!roomId) return;

  socket.join(roomId);

  const room = io.sockets.adapter.rooms.get(roomId);
  const users = room ? [...room] : [];

  /* SAVE CALL START */
  let call = await Call.findOne({ roomId });

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

  if (users.length > 6) {
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
    await Call.findOneAndUpdate(
    { roomId },
    { endedAt: new Date() }
  );
    socket.leave(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    const remainingUsers = room ? [...room] : [];

    if (remainingUsers.length === 1) {
      io.to(remainingUsers[0]).emit("role", { initiator: true });
    }

    socket.to(roomId).emit("user-left");
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

socket.on("disconnecting", async () => {
  for (const roomId of socket.rooms) {
    if (roomId !== socket.id) {
      await Call.findOneAndUpdate(
        { roomId },
        { endedAt: new Date() }
      );

      socket.to(roomId).emit("user-left");
    }
  }
});

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.user?.id);
  });
});

/*  DATABASE CONNECTION */
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