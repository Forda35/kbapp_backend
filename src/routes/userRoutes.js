const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  renderResetPage,
  deleteAccount,
} = require("../controllers/userController");
const auth = require("../middleware/auth");

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
router.delete("/delete-account", auth, deleteAccount);
module.exports = router;