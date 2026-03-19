import mongoose from "mongoose";

const callSchema = new mongoose.Schema({
  roomId: String,
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model("Call", callSchema);