const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  renderResetPage,
} = require("../controllers/userController");

router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/reset-password-page", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send(renderResetPage("Token manquant", false));
  res.send(renderResetPage(token, true));
});

module.exports = router;