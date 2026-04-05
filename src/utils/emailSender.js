const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL}/api/users/verify-email?token=${token}`;

  const { error } = await resend.emails.send({
    from: "KBApp <onboarding@resend.dev>",
    to: email,
    subject: "Vérifiez votre adresse email – KBApp",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#fff;padding:40px;border-radius:16px;">
        <h1 style="color:#FFD700;text-align:center;">KBApp</h1>
        <h2 style="color:#fff;">Vérifiez votre adresse email</h2>
        <p style="color:#ccc;line-height:1.6;">
          Merci de vous être inscrit ! Cliquez sur le bouton ci-dessous pour activer votre compte.
        </p>
        <div style="text-align:center;margin:35px 0;">
          <a href="${verifyUrl}"
             style="background:linear-gradient(135deg,#1E3A8A,#1a6ec7);color:#FFD700;padding:16px 40px;text-decoration:none;border-radius:12px;font-size:16px;font-weight:bold;border:2px solid #FFD700;">
            Vérifier mon email
          </a>
        </div>
        <p style="color:#999;font-size:13px;">Ce lien expire dans <strong>24 heures</strong>.</p>
        <p style="color:#666;font-size:11px;text-align:center;margin-top:20px;">© 2024 KBApp</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
};

exports.sendResetEmail = async (email, resetUrl) => {
  // resetUrl sera maintenant /api/users/reset-password-page?token=xxx
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Réinitialisation de votre mot de passe – KBApp",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #fff; padding: 40px; border-radius: 16px;">
        <h1 style="color: #FFD700; text-align: center;">KBApp</h1>
        <h2 style="color: #fff;">Réinitialisation du mot de passe</h2>
        <p style="color: #ccc;">Cliquez sur le bouton ci-dessous. Ce lien expire dans <strong style="color: #FFD700;">1 heure</strong>.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #1E3A8A, #1a6ec7); color: #FFD700; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: bold; border: 2px solid #FFD700;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color: #999; font-size: 13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      </div>
    `,
  });
if (error) throw new Error(error.message);
};