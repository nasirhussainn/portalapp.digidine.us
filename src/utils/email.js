const nodemailer = require("nodemailer");

/**
 * =========================
 * 📧 TRANSPORT CONFIGURATION
 * =========================
 */

// ===== OPTION 1: Gmail =====
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// ===== OPTION 2: noreply@softechinc.ai =====
const transporter = nodemailer.createTransport({
  host: "softechinc.ai",       // Outgoing server
  port: 465,                   // SMTP port for SSL/TLS
  secure: true,                // true for port 465
  auth: {
    user: process.env.EMAIL_USER, // Email address
    pass: process.env.EMAIL_PASS,  // Store in .env for security
  },
});


/**
 * 🔐 Account Activation Email
 */
exports.sendActivationEmail = (to, token) => {
  const activationLink = `${process.env.CLIENT_URL}/api/auth/activate-account/${token}`;
  const mailOptions = {
    from: `"Q Work Support" <${process.env.EMAIL_USER || "noreply@softechinc.ai"}>`,
    to,
    subject: "Activate Your Q Work Account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
        <h2 style="color:#2E86C1;">Welcome to Q Work!</h2>
        <p>Hello,</p>
        <p>Thank you for signing up with <strong>Q Work</strong>.</p>
        <p>To activate your account, please click the button below:</p>
        <a href="${activationLink}" style="display:inline-block;background-color:#28a745;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Activate Account</a>
        <p>If the button doesn’t work, copy and paste the following link into your browser:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <hr>
        <p style="font-size:12px;color:#888;">If you did not sign up for Q Work, please ignore this email.</p>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("❌ Activation email error:", err);
    else console.log("✅ Activation email sent to:", to);
  });
};

/**
 * 🔁 Password Reset Email
 */
exports.sendResetEmail = (to, token) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;

  const mailOptions = {
    from: `"Q Work Support" <${process.env.EMAIL_USER || "noreply@softechinc.ai"}>`,
    to,
    subject: "Reset Your Q Work Password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
        <h2 style="color:#C0392B;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password for your Q Work account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetLink}" style="display:inline-block;background-color:#dc3545;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a>
        <p>If you didn’t request this, you can safely ignore this email.</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <hr>
        <p style="font-size:12px;color:#888;">Q Work | Support Team</p>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("❌ Reset email error:", err);
    else console.log("✅ Password reset email sent to:", to);
  });
};
