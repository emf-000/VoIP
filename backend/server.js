import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/authRoutes.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/auth", authRoutes);

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

  socket.on("join-room", (roomId) => {
    if (!roomId) return;

    const room = io.sockets.adapter.rooms.get(roomId);
    const usersInRoom = room ? room.size : 0;

    socket.join(roomId);

    console.log(`User ${socket.user.id} joined room ${roomId}`);

    if (usersInRoom === 0) {
      socket.emit("role", { initiator: true });
    } else {
      socket.emit("role", { initiator: false });

      socket.to(roomId).emit("user-joined", {
        userId: socket.user.id,
      });
    }
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