import Call from "../models/Call.js";

export const getCallHistory = async (req, res) => {
  const calls = await Call.find({
    users: req.user.id
  }).sort({ createdAt: -1 });

  res.json(calls);
};

export const deleteCall = async (req, res) => {
  try {
    const { id } = req.params;

    const call = await Call.findById(id);

    if (!call) {
      return res.status(404).json({ message: "Call not found" });
    }

    await Call.findByIdAndDelete(id);

    res.json({ message: "Call deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};