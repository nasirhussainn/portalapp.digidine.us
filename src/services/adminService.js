const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { sendAdminTempPassword } = require("../utils/email");

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const [results] = await db.execute("SELECT * FROM admins WHERE email = ?", [
      email,
    ]);

    if (results.length === 0)
      return res.status(400).json({ message: "Admin not found" });

    const admin = results[0];

    if (!admin.is_active) {
      return res
        .status(403)
        .json({ message: "Your admin account is deactivated" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    // ✅ Generate tokens
    const accessToken = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const refreshToken = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Admin login successful",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("❌ Admin Login error:", err);
    res.status(500).json({ message: "Admin login failed" });
  }
};

exports.forgetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [results] = await db.execute("SELECT * FROM admins WHERE email = ?", [email]);
    if (results.length === 0) return res.status(404).json({ message: "Admin not found" });

    const admin = results[0];

    if (!admin.is_active) return res.status(403).json({ message: "Admin account is deactivated" });

    // ✅ Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8); // 8-char random
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await db.execute("UPDATE admins SET password = ? WHERE id = ?", [hashedPassword, admin.id]);

    // ✅ Send email
    await sendAdminTempPassword(admin.email, tempPassword);

    res.json({ message: "Temporary password sent to your email" });
  } catch (err) {
    console.error("❌ Admin forget password error:", err);
    res.status(500).json({ message: "Failed to process request" });
  }
};

exports.resetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const adminId = req.user.id;

  if (!newPassword || !confirmPassword)
    return res.status(400).json({ message: "New password and confirm password are required" });

  if (newPassword !== confirmPassword)
    return res.status(400).json({ message: "Passwords do not match" });

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute("UPDATE admins SET password = ? WHERE id = ?", [hashedPassword, adminId]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ Admin reset password error:", err);
    res.status(500).json({ message: "Failed to update password" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const adminId = req.user.id; 

    const [results] = await db.execute(
      "SELECT id, email, role, is_active, created_at, updated_at FROM admins WHERE id = ?",
      [adminId]
    );

    if (results.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({ admin: results[0] });
  } catch (err) {
    console.error("❌ Get admin profile error:", err);
    res.status(500).json({ message: "Failed to fetch admin profile" });
  }
};

