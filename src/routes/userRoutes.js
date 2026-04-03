const express = require("express");
const router = express.Router();
const { register, login, verifyEmail, forgotPassword, resetPassword } = require("../controllers/userController");

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);

module.exports = router;