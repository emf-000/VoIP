import express from "express";
import { getProfile, getAllUsers, deleteUser } from "../controllers/userController.js";
import { isAdmin } from "../middlewares/admin.js";
import { protect } from "../middlewares/authMiddleware.js"; // your existing auth

const router = express.Router();

router.get("/profile", protect, getProfile);

// ADMIN ROUTES
router.get("/all", protect, isAdmin, getAllUsers);
router.delete("/:id", protect, isAdmin, deleteUser);

export default router;