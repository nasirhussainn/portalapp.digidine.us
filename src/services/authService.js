const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const db = require("../config/db");
const { sendActivationEmail, sendResetEmail } = require("../utils/email");
const { insertInterest, createUploadDir } = require("../utils/helpers");
const fs = require("fs");
const path = require("path");
const sendResponse = require("../utils/sendResponse");

// Ensure upload dir exists
createUploadDir();

const uploadDir = path.join(__dirname, "..", "uploads", "profile_images");

exports.signup = async (req, res) => {
  const connection = await db.getConnection();
  let profileImageFileName = null;

  try {
    await connection.beginTransaction();

    const {
      email, password, firstName, lastName, contactEmail, dateOfBirth,
      address, city, state, professional_headshot, professional_summary,
      availability, categories, keywords, years_of_experience,
      // New fields for experience, education, and pricing
      experiences, education, pricing
    } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const activationToken = crypto.randomBytes(20).toString("hex");

    const [userResult] = await connection.query(
      "INSERT INTO users (email, password, activation_token, is_active) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, activationToken, false]
    );
    const userId = userResult.insertId;

    // ✅ Save image to disk only after DB is successful
    let profileImagePath = null;
    if (req.file) {
      profileImageFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const fullImagePath = path.join(uploadDir, profileImageFileName);
      fs.writeFileSync(fullImagePath, req.file.buffer);
      profileImagePath = `/uploads/profile_images/${profileImageFileName}`;
    }

    // Insert user profile
    await connection.query(
      `INSERT INTO user_profiles 
        (user_id, profile_image, first_name, last_name, contact_email, date_of_birth, address, city, state, professional_headshot, professional_summary, availability, years_of_experience)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, profileImagePath, firstName, lastName, contactEmail,
        dateOfBirth, address, city, state, professional_headshot, professional_summary, availability, years_of_experience
      ]
    );

    // Insert categories and keywords
    const categoryIds = await Promise.all(
      JSON.parse(categories || "[]").map((c) => insertInterest(connection, c, "category"))
    );
    const keywordIds = await Promise.all(
      JSON.parse(keywords || "[]").map((k) => insertInterest(connection, k, "keyword"))
    );

    for (const id of categoryIds) {
      await connection.query(
        "INSERT INTO user_interests (user_id, category_id, interest_type) VALUES (?, ?, 'category')",
        [userId, id]
      );
    }

    for (const id of keywordIds) {
      await connection.query(
        "INSERT INTO user_interests (user_id, keyword_id, interest_type) VALUES (?, ?, 'keyword')",
        [userId, id]
      );
    }

    // ✅ Insert user experiences
    const experiencesData = JSON.parse(experiences || "[]");
    for (const exp of experiencesData) {
      await connection.query(
        `INSERT INTO user_experience 
          (user_id, job_title, company_name, employment_type, location, start_date, end_date, is_current, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, exp.job_title, exp.company_name, exp.employment_type || 'Full-time',
          exp.location, exp.start_date, exp.end_date, exp.is_current || false, exp.description
        ]
      );
    }

    // ✅ Insert user education
    const educationData = JSON.parse(education || "[]");
    for (const edu of educationData) {
      await connection.query(
        `INSERT INTO user_education 
          (user_id, institution_name, degree, field_of_study, start_date, end_date, is_current, grade, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, edu.institution_name, edu.degree, edu.field_of_study,
          edu.start_date, edu.end_date, edu.is_current || false, edu.grade, edu.description
        ]
      );
    }

    // ✅ Insert user pricing
    const pricingData = JSON.parse(pricing || "{}");
    if (pricingData.rate_type) {
      await connection.query(
        `INSERT INTO user_pricing 
          (user_id, rate_type, hourly_rate, min_project_rate, is_negotiable, pricing_description)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId, pricingData.rate_type, pricingData.hourly_rate,
          pricingData.min_project_rate, pricingData.is_negotiable !== false,
          pricingData.pricing_description
        ]
      );
    }

    await connection.commit();
    await sendActivationEmail(email, activationToken);

    res.json({
      message: "Signup successful. Please check your email to activate your account.",
    });

  } catch (error) {
    console.error("❌ Signup error:", error);
    await connection.rollback();

    // ❗ If image was saved before crash, remove it
    if (profileImageFileName) {
      const imagePath = path.join(uploadDir, profileImageFileName);
      if (fs.existsSync(imagePath)) {
        fs.unlink(imagePath, (err) => {
          if (err) console.error("❌ Failed to delete uploaded image:", err);
          else console.log("🧹 Uploaded image deleted due to signup failure.");
        });
      }
    }

    res.status(500).json({ error: "Signup failed" });
  } finally {
    connection.release();
  }
};

exports.activateAccount = async (req, res) => {
  const { token } = req.params;

  try {
    // Step 1: Look up user by token
    const [results] = await db.execute(
      "SELECT * FROM users WHERE activation_token = ?",
      [token]
    );

    if (!results.length) {
      // Step 2: If token not found, check if account already active
      const [activeUser] = await db.execute(
        "SELECT * FROM users WHERE activation_token IS NULL AND is_active = true"
      );

      if (activeUser.length) {
        return sendResponse(req, res, {
          status: "info",
          title: "Already Activated",
          message: "Your account is already active. You can log in directly."
        });
      }

      // Step 3: Otherwise, invalid/expired link
      return sendResponse(req, res, {
        status: "error",
        title: "Activation Failed",
        message: "Your activation link is invalid."
      });
    }

    // Step 4: Activate account
    const user = results[0];
    await db.execute(
      "UPDATE users SET is_active = true, activation_token = NULL WHERE id = ?",
      [user.id]
    );

    sendResponse(req, res, {
      status: "success",
      title: "Account Activated!",
      message: "Your account has been successfully activated. You can now log in."
    });

  } catch (err) {
    console.error("❌ Activation error:", err);
    sendResponse(req, res, {
      status: "error",
      title: "Server Error",
      message: "Something went wrong while activating your account. Please try again later."
    });
  }
};


exports.resendActivationEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [results] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!results.length)
      return res.status(404).json({ message: "User not found" });

    const user = results[0];
    if (user.is_active)
      return res.status(400).json({ message: "Account already activated" });

    const newToken = crypto.randomBytes(20).toString("hex");
    await db.execute("UPDATE users SET activation_token = ? WHERE email = ?", [
      newToken,
      email,
    ]);
    await sendActivationEmail(email, newToken);

    res.json({ message: "Activation email resent. Please check your inbox." });
  } catch (err) {
    console.error("Resend activation error:", err);
    res.status(500).json({ message: "Failed to resend activation email" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const [results] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (results.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = results[0];
    if (!user.is_active)
      return res.status(400).json({ message: "Account not activated" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ message: "Login successful", accessToken, refreshToken });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
};

exports.getCurrentUser = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.id;

    // Get base user
    const [users] = await connection.query(
      "SELECT id, email, is_premium, is_active, created_at, updated_at FROM users WHERE id = ?",
      [userId]
    );
    if (!users.length)
      return res.status(404).json({ message: "User not found" });

    const user = users[0];

    // Get profile
    const [profile] = await connection.query(
      "SELECT * FROM user_profiles WHERE user_id = ?",
      [user.id]
    );

    // Get interests - UPDATED 
    const [categories] = await connection.query(
      `SELECT c.id, c.name FROM user_interests ui
       JOIN categories c ON ui.category_id = c.id
       WHERE ui.user_id = ? AND ui.interest_type = 'category'`,
      [user.id]
    );

    const [keywords] = await connection.query(
      `SELECT k.id, k.name FROM user_interests ui
       JOIN keywords k ON ui.keyword_id = k.id
       WHERE ui.user_id = ? AND ui.interest_type = 'keyword'`,
      [user.id]
    );

    // ✅ Get user experiences
    const [experiences] = await connection.query(
      `SELECT id, job_title, company_name, employment_type, location, 
              start_date, end_date, is_current, description,
              created_at, updated_at
       FROM user_experience 
       WHERE user_id = ? 
       ORDER BY is_current DESC, end_date DESC, start_date DESC`,
      [user.id]
    );

    // ✅ Get user education
    const [education] = await connection.query(
      `SELECT id, institution_name, degree, field_of_study, 
              start_date, end_date, is_current, grade, description,
              created_at, updated_at
       FROM user_education 
       WHERE user_id = ? 
       ORDER BY is_current DESC, end_date DESC, start_date DESC`,
      [user.id]
    );

    // ✅ Get user pricing
    const [pricing] = await connection.query(
      `SELECT id, rate_type, hourly_rate, min_project_rate, 
              is_negotiable, pricing_description,
              created_at, updated_at
       FROM user_pricing 
       WHERE user_id = ?`,
      [user.id]
    );

    const userProfile = profile[0] || {};
    if (userProfile.profile_image) {
      userProfile.profile_image = process.env.CLIENT_URL + userProfile.profile_image;
    }

    res.json({
      ...user,
      profile: userProfile,
      interests: {
        categories,
        keywords,
      },
      experiences: experiences || [],
      education: education || [],
      pricing: pricing[0] || null
    });
  } catch (err) {
    console.error("❌ Get current user error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
};


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [results] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (!results.length)
      return res.status(400).json({ message: "User not found" });

    const token = crypto.randomBytes(10).toString("hex");
    const expiry = dayjs().add(1, "hour").format("YYYY-MM-DD HH:mm:ss");

    await db.execute(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?",
      [token, expiry, email]
    );

    await sendResetEmail(email, token);
    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ error: "DB error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!password)
    return res.status(400).json({ message: "New password required" });

  try {
    const now = new Date();
    const [results] = await db.execute(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?",
      [token, now]
    );

    if (!results.length)
      return res.status(400).json({ message: "Invalid or expired token" });

    const user = results[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.execute(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
      [hashedPassword, user.id]
    );

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(500).json({ error: "Reset failed" });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ message: "Refresh token required" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

exports.logout = (req, res) => {
  // Optionally blacklist token (advanced)
  res.json({ message: "Logout successful" });
};
