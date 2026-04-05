const express = require("express");
const router = express.Router();
const { register, login, verifyEmail, forgotPassword, resetPassword } = require("../controllers/userController");

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);

// Page HTML de reset (ouverte dans le navigateur depuis l'email)
router.get("/reset-password-page", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send(renderResetPage("Token manquant", false));
  res.send(renderResetPage(token, true));
});

const { register, login, verifyEmail, forgotPassword, resetPassword, renderResetPage } = require("../controllers/userController");


router.get("/reset-password-page", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send(renderResetPage("Token manquant", false));
  res.send(renderResetPage(token, true));
});
module.exports = router;