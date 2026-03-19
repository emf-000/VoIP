import Call from "../models/Call.js";

export const getCallHistory = async (req, res) => {
  const calls = await Call.find({
    users: req.user.id
  }).sort({ startedAt: -1 });

  res.json(calls);
};

export const deleteCall = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const call = await Call.findById(id);

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    call.users = call.users.filter(
      (u) => u.toString() !== userId
    );

    if (call.users.length === 0) {
      await call.deleteOne();
    } else {
      await call.save();
    }

    res.json({ message: "Call removed from your history" });

  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};

