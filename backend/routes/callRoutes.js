import express from "express";
import { getCallHistory,deleteCall } from "../controllers/callController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/history", protect, getCallHistory);
router.delete("/:id", protect, deleteCall);

export default router;