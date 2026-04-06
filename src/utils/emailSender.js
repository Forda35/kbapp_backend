const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL}/api/users/verify-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Vérifiez votre adresse email – KB Events App",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#fff;padding:40px;border-radius:16px;">
        <h1 style="color:#FFD700;text-align:center;">KB Events</h1>
        <h2 style="color:#fff;">Vérifiez votre adresse email</h2>
        <p style="color:#ccc;line-height:1.6;">Merci de vous être inscrit ! Cliquez ci-dessous pour activer votre compte.</p>
        <div style="text-align:center;margin:35px 0;">
          <a href="${verifyUrl}" style="background:linear-gradient(135deg,#1E3A8A,#1a6ec7);color:#FFD700;padding:16px 40px;text-decoration:none;border-radius:12px;font-size:16px;font-weight:bold;border:2px solid #FFD700;">
          Vérifier mon email
          </a>
        </div>
        <p style="color:#999;font-size:13px;">Ce lien expire dans <strong>24 heures</strong>.</p>
        <p style="color:#666;font-size:11px;text-align:center;margin-top:20px;">© 2026 KB Events</p>
      </div>
    `,
  });
};

exports.sendResetEmail = async (email, resetUrl) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Réinitialisation de votre mot de passe – KB Events App",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#fff;padding:40px;border-radius:16px;">
        <h1 style="color:#FFD700;text-align:center;">KBApp</h1>
        <h2 style="color:#fff;">Réinitialisation du mot de passe</h2>
        <p style="color:#ccc;">Cliquez ci-dessous. Ce lien expire dans <strong style="color:#FFD700;">1 heure</strong>.</p>
        <div style="text-align:center;margin:35px 0;">
          <a href="${resetUrl}" style="background:linear-gradient(135deg,#1E3A8A,#1a6ec7);color:#FFD700;padding:16px 40px;text-decoration:none;border-radius:12px;font-size:16px;font-weight:bold;border:2px solid #FFD700;">
      Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color:#999;font-size:13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        <p style="color:#666;font-size:11px;text-align:center;margin-top:20px;">© 2026 KB Events</p>
      </div>
    `,
  });
};