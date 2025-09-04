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
// Enhanced sendStatusChangeEmail with debugging and spam-prevention for banned emails
exports.sendStatusChangeEmail = (to, oldStatus, newStatus, token = null) => {
  let subject = "";
  let html = "";

  // Add debugging
  console.log(`🔍 Attempting to send status change email:`);
  console.log(`   To: ${to}`);
  console.log(`   Old Status: ${oldStatus}`);
  console.log(`   New Status: ${newStatus}`);
  console.log(`   Token: ${token ? 'Present' : 'None'}`);

  // Common email styling
  const emailStyle = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2c3e50; margin: 0; font-size: 24px;">Q Work</h1>
        <p style="color: #7f8c8d; margin: 5px 0 0 0; font-size: 14px;">Professional Services Platform</p>
      </div>
  `;

  const emailFooter = `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; text-align: center;">
        <p style="color: #95a5a6; font-size: 12px; margin: 0;">
          This is an automated message from Q Work. Please do not reply to this email.
        </p>
        <p style="color: #95a5a6; font-size: 12px; margin: 5px 0 0 0;">
          If you have questions, please contact our support team.
        </p>
      </div>
    </div>
  `;

  switch (newStatus) {
    case "approved":
      if (token) {
        // First-time approval - needs activation
        const activationLink = `${process.env.CLIENT_URL}/api/auth/activate-account/${token}`;
        subject = "🎉 Welcome to Q Work - Account Approved!";
        html = emailStyle + `
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px; border-radius: 8px; display: inline-block;">
              <h2 style="margin: 0; font-size: 20px;">🎉 Congratulations!</h2>
            </div>
          </div>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Great news! Your Q Work account application has been <strong>approved</strong> by our team.
          </p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Your account status has been updated from <span style="background-color: #ffeaa7; padding: 2px 6px; border-radius: 4px; color: #2d3436;"><strong>${oldStatus}</strong></span> to <span style="background-color: #00b894; color: white; padding: 2px 6px; border-radius: 4px;"><strong>${newStatus}</strong></span>.
          </p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            To complete your registration and start using Q Work, please activate your account by clicking the button below:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${activationLink}" style="display: inline-block; background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              🚀 Activate My Account
            </a>
          </div>
          <p style="color: #7f8c8d; font-size: 14px; line-height: 1.5;">
            <strong>Note:</strong> This activation link will expire in 48 hours for security purposes.
          </p>
          <p style="color: #7f8c8d; font-size: 14px; line-height: 1.5;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; color: #495057;">
            <a href="${activationLink}" style="color: #007bff;">${activationLink}</a>
          </p>
        ` + emailFooter;
      } else {
        // Re-approval - no activation needed
        subject = "✅ Account Status Updated - Welcome Back to Q Work";
        html = emailStyle + `
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px; border-radius: 8px; display: inline-block;">
              <h2 style="margin: 0; font-size: 20px;">✅ Account Reactivated</h2>
            </div>
          </div>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Good news! Your Q Work account status has been updated by our administrative team.
          </p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Your account status has changed from <span style="background-color: #fab1a0; padding: 2px 6px; border-radius: 4px; color: #2d3436;"><strong>${oldStatus}</strong></span> to <span style="background-color: #00b894; color: white; padding: 2px 6px; border-radius: 4px;"><strong>${newStatus}</strong></span>.
          </p>
          <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
            Your account is now active and you can continue using Q Work's services without any restrictions.
          </p>
        ` + emailFooter;
      }
      break;

    case "rejected":
      subject = "Account Status Update - Q Work Application";
      html = emailStyle + `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 15px; border-radius: 8px; display: inline-block;">
            <h2 style="margin: 0; font-size: 20px;">Account Status Update</h2>
          </div>
        </div>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          We hope this message finds you well. We're writing to inform you about a change to your Q Work account status.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          Your account status has been updated from <span style="background-color: #ffeaa7; padding: 2px 6px; border-radius: 4px; color: #2d3436;"><strong>${oldStatus}</strong></span> to <span style="background-color: #e17055; color: white; padding: 2px 6px; border-radius: 4px;"><strong>${newStatus}</strong></span>.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          Unfortunately, your account application did not meet our current requirements. This decision was made after careful review by our team.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          If you believe this decision was made in error or would like to understand the specific reasons, please don't hesitate to contact our support team for clarification.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:support@qwork.com" style="display: inline-block; background: linear-gradient(135deg, #6c5ce7, #5a4fcf); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            📧 Contact Support
          </a>
        </div>
      ` + emailFooter;
      break;

    case "banned":
      // 🔥 FIXED: Removed spam-triggering words and improved content
      subject = "Important Account Status Update - Q Work";
      html = emailStyle + `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #636e72, #2d3436); color: white; padding: 15px; border-radius: 8px; display: inline-block;">
            <h2 style="margin: 0; font-size: 20px;">Account Status Update</h2>
          </div>
        </div>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          We are writing to inform you of an important change to your Q Work account status.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          Your account status has been updated from <span style="background-color: #ffeaa7; padding: 2px 6px; border-radius: 4px; color: #2d3436;"><strong>${oldStatus}</strong></span> to <span style="background-color: #636e72; color: white; padding: 2px 6px; border-radius: 4px;"><strong>restricted</strong></span>.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          This action was taken following a review of your account activity. Access to Q Work services has been restricted as per our terms of service.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          If you have questions about this decision or wish to discuss your account status, please contact our support team with your account details.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:support@qwork.com" style="display: inline-block; background: linear-gradient(135deg, #6c5ce7, #5a4fcf); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Contact Support Team
          </a>
        </div>
      ` + emailFooter;
      break;

    case "hold":
      subject = "Account Status Update - Temporarily On Hold";
      html = emailStyle + `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #fdcb6e, #e17055); color: white; padding: 15px; border-radius: 8px; display: inline-block;">
            <h2 style="margin: 0; font-size: 20px;">⏸️ Account On Hold</h2>
          </div>
        </div>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          We're writing to inform you about a temporary change to your Q Work account status.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          Your account status has been updated from <span style="background-color: #ffeaa7; padding: 2px 6px; border-radius: 4px; color: #2d3436;"><strong>${oldStatus}</strong></span> to <span style="background-color: #fdcb6e; color: white; padding: 2px 6px; border-radius: 4px;"><strong>${newStatus}</strong></span>.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          Your account has been temporarily placed on hold for review. This may be due to additional verification requirements or pending documentation.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          We appreciate your patience during this process. If you have any questions or need to provide additional information, please contact our support team.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:support@qwork.com" style="display: inline-block; background: linear-gradient(135deg, #6c5ce7, #5a4fcf); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            📧 Contact Support
          </a>
        </div>
      ` + emailFooter;
      break;

    default:
      subject = "Account Status Update - Q Work";
      html = emailStyle + `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #74b9ff, #0984e3); color: white; padding: 15px; border-radius: 8px; display: inline-block;">
            <h2 style="margin: 0; font-size: 20px;">📋 Status Update</h2>
          </div>
        </div>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          We're writing to inform you about a change to your Q Work account status.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          Your account status has been updated from <span style="background-color: #ffeaa7; padding: 2px 6px; border-radius: 4px; color: #2d3436;"><strong>${oldStatus}</strong></span> to <span style="background-color: #74b9ff; color: white; padding: 2px 6px; border-radius: 4px;"><strong>${newStatus}</strong></span>.
        </p>
        <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
          This change has been made by our administrative team. If you have any questions about this update, please don't hesitate to contact our support team.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:support@qwork.com" style="display: inline-block; background: linear-gradient(135deg, #6c5ce7, #5a4fcf); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            📧 Contact Support
          </a>
        </div>
      ` + emailFooter;
  }

  const mailOptions = {
    from: `"Q Work Support" <${process.env.EMAIL_USER || "noreply@softechinc.ai"}>`,
    to,
    subject,
    html,
    // Add these options to help with deliverability
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal'
    }
  };

  // Enhanced logging for debugging
  console.log(`📧 Email details for ${newStatus}:`);
  console.log(`   Subject: ${subject}`);
  console.log(`   From: ${mailOptions.from}`);
  console.log(`   To: ${to}`);

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error(`❌ Status change email error for ${newStatus}:`, err);
      console.error(`   Full error details:`, {
        message: err.message,
        code: err.code,
        response: err.response,
        responseCode: err.responseCode
      });
    } else {
      console.log(`✅ Status change email (${oldStatus} → ${newStatus}) sent successfully to: ${to}`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response}`);
    }
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
