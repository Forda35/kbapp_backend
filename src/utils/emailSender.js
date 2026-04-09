const { TransactionalEmailsApi, SendSmtpEmail, ApiClient } = require("@getbrevo/brevo");

const apiClient = ApiClient.instance;
apiClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new TransactionalEmailsApi();

const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || "support.kbevents.mg@gmail.com";
const FROM_NAME = "KB Events";

exports.sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL}/api/users/verify-email?token=${token}`;

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: FROM_NAME, email: FROM_EMAIL };
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.subject = "Vérifiez votre adresse email – KB Events";
  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#fff;padding:40px;border-radius:16px;">
      <h1 style="color:#FFD700;text-align:center;">KBApp</h1>
      <h2 style="color:#fff;">Vérifiez votre adresse email</h2>
      <p style="color:#ccc;line-height:1.6;">
        Merci de vous être inscrit ! Cliquez ci-dessous pour activer votre compte.
      </p>
      <div style="text-align:center;margin:35px 0;">
        <a href="${verifyUrl}"
           style="background:linear-gradient(135deg,#1E3A8A,#1a6ec7);color:#FFD700;padding:16px 40px;text-decoration:none;border-radius:12px;font-size:16px;font-weight:bold;border:2px solid #FFD700;">
        Vérifier mon email
        </a>
      </div>
      <p style="color:#999;font-size:13px;">Ce lien expire dans <strong>24 heures</strong>.</p>
      <p style="color:#ccc;font-size:12px;">
        Si vous ne trouvez pas cet email dans votre boîte de réception, 
        vérifiez votre dossier <strong>spam ou indésirables</strong>.
      </p>
    </div>
  `;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

exports.sendResetEmail = async (email, resetUrl) => {
  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: FROM_NAME, email: FROM_EMAIL };
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.subject = "Réinitialisation de votre mot de passe – KB Events";
  sendSmtpEmail.htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#fff;padding:40px;border-radius:16px;">
      <h1 style="color:#FFD700;text-align:center;">KBApp</h1>
      <h2 style="color:#fff;">Réinitialisation du mot de passe</h2>
      <p style="color:#ccc;">
        Cliquez ci-dessous. Ce lien expire dans 
        <strong style="color:#FFD700;">1 heure</strong>.
      </p>
      <div style="text-align:center;margin:35px 0;">
        <a href="${resetUrl}"
           style="background:linear-gradient(135deg,#1E3A8A,#1a6ec7);color:#FFD700;padding:16px 40px;text-decoration:none;border-radius:12px;font-size:16px;font-weight:bold;border:2px solid #FFD700;">
        Réinitialiser mot de passe
        </a>
      </div>
      <p style="color:#999;font-size:13px;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      </p>
    </div>
  `;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};