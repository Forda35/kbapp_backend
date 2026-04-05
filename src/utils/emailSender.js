const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Envoie un email de vérification de compte
 */
exports.sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL || "http://localhost:5000"}/api/users/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "KBApp <noreply@kbapp.com>",
    to: email,
    subject: "Vérifiez votre adresse email – KBApp",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #fff; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FFD700; font-size: 28px; margin: 0;">KBApp</h1>
          <p style="color: #4A90D9; margin: 5px 0;">Votre application billetterie</p>
        </div>
        
        <h2 style="color: #fff; margin-bottom: 15px;">Vérifiez votre adresse email</h2>
        <p style="color: #ccc; line-height: 1.6;">
          Merci de vous être inscrit sur KBApp ! Pour activer votre compte et commencer à acheter vos billets, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
        </p>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="${verifyUrl}" 
             style="background: linear-gradient(135deg, #1E3A8A, #1a6ec7); color: #FFD700; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: bold; display: inline-block; border: 2px solid #FFD700;">
            Vérifier mon email
          </a>
        </div>
        
        <p style="color: #999; font-size: 13px; margin-top: 20px;">
          Ce lien expire dans <strong style="color: #FFD700;">24 heures</strong>. Si vous n'avez pas créé de compte, ignorez cet email.
        </p>
        
        <div style="border-top: 1px solid #333; margin-top: 30px; padding-top: 20px; text-align: center;">
          <p style="color: #666; font-size: 12px;">© 2024 KBApp – Tous droits réservés</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

exports.sendResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || "KBApp <noreply@kbapp.com>",
    to: email,
    subject: "Réinitialisation de votre mot de passe – KBApp",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #fff; padding: 40px; border-radius: 16px;">
        <h1 style="color: #FFD700; text-align: center;">KBApp</h1>
        <h2 style="color: #fff;">Réinitialisation du mot de passe</h2>
        <p style="color: #ccc;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous. Ce lien expire dans <strong style="color: #FFD700;">1 heure</strong>.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #1E3A8A, #1a6ec7); color: #FFD700; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: bold; border: 2px solid #FFD700;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color: #999; font-size: 13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
};