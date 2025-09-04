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
 * 📧 Notify user about profile status change
 */
exports.sendStatusChangeEmail = (to, status, token = null) => {
  let subject = "";
  let html = "";

  switch (status) {
    case "approved":
      const activationLink = `${process.env.CLIENT_URL}/api/auth/activate-account/${token}`;
      subject = "Your Q Work Account Has Been Approved";
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
          <h2 style="color:#28a745;">Great news!</h2>
          <p>Your Q Work account has been <strong>approved</strong> by our team.</p>
          <p>To activate your account, please click the button below:</p>
          <a href="${activationLink}" style="display:inline-block;background-color:#28a745;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Activate Account</a>
          <p>If the button doesn’t work, copy and paste this link:</p>
          <p><a href="${activationLink}">${activationLink}</a></p>
        </div>
      `;
      break;

    case "rejected":
      subject = "Your Q Work Account Request Was Rejected";
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
          <h2 style="color:#C0392B;">We’re sorry</h2>
          <p>Unfortunately, your Q Work account request was <strong>rejected</strong> by our team.</p>
          <p>If you believe this was a mistake, you may contact support for further assistance.</p>
        </div>
      `;
      break;

    case "suspended":
      subject = "Your Q Work Account Has Been Suspended";
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
          <h2 style="color:#E67E22;">Account Suspended</h2>
          <p>Your Q Work account has been temporarily <strong>suspended</strong> by the administrator.</p>
          <p>Please reach out to support if you need clarification or want to resolve this issue.</p>
        </div>
      `;
      break;

    default:
      subject = "ℹ️ Your Q Work Account Status Changed";
      html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:10px;">
          <h2 style="color:#2E86C1;">Status Update</h2>
          <p>Your Q Work account status has been updated to: <strong>${status}</strong>.</p>
        </div>
      `;
  }

  const mailOptions = {
    from: `"Q Work Support" <${process.env.EMAIL_USER || "noreply@softechinc.ai"}>`,
    to,
    subject,
    html,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("❌ Status change email error:", err);
    else console.log(`✅ Status change email (${status}) sent to:`, to);
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
