const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const { insertInterest } = require("../utils/helpers");

const uploadDir = path.join(__dirname, "..", "uploads", "profile_images");

exports.getSingleUser = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [results] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (!results.length)
      return res.status(404).json({ message: "User not found" });
    res.json(results[0]);
  } catch (err) {
    console.error("❌ Get single user error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllUsers = async (_, res) => {
  try {
    const [results] = await db.execute("SELECT * FROM users");
    res.json(results);
  } catch (err) {
    console.error("❌ Get all users error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getPremiumUsers = async (_, res) => {
  try {
    const [results] = await db.execute(
      "SELECT * FROM users WHERE is_premium = true"
    );
    res.json(results);
  } catch (err) {
    console.error("❌ Get premium users error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteAccount = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const connection = await db.getConnection();
  try {
    const [[user]] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    const [[profile]] = await connection.query(
      "SELECT profile_image FROM user_profiles WHERE user_id = ?",
      [user.id]
    );
    const imagePath = profile?.profile_image
      ? path.join(__dirname, "..", profile.profile_image)
      : null;

    await connection.query("DELETE FROM users WHERE id = ?", [user.id]);
    // Related tables will auto-clean via ON DELETE CASCADE

    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlink(imagePath, (err) => {
        if (err) console.error("❌ Error deleting profile image:", err);
      });
    }

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("❌ Delete account error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
};

exports.updateProfile = async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    contactEmail,
    dateOfBirth,
    address,
    city,
    state,
    zipCode,
    shortDescription,
    longDescription,
    availability,
    categories,
    keywords,
  } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const connection = await db.getConnection();
  let newProfileImagePath = null;
  let oldImagePath = null;

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (!userRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].id;

    // 🔍 Get old profile image to delete later
    const [profileRows] = await connection.query(
      "SELECT profile_image FROM user_profiles WHERE user_id = ?",
      [userId]
    );
    if (profileRows.length && profileRows[0].profile_image) {
      oldImagePath = path.join(__dirname, "..", profileRows[0].profile_image);
    }

    // 🖼️ Handle new image upload
    if (req.file) {
      newProfileImagePath = `/uploads/profile_images/${req.file.filename}`;
    }

    // ✅ Replace user_profiles
    await connection.query(
      `UPDATE user_profiles SET 
          profile_image = ?, first_name = ?, last_name = ?, contact_email = ?, 
          date_of_birth = ?, address = ?, city = ?, state = ?, zip_code = ?, 
          short_description = ?, long_description = ? 
        WHERE user_id = ?`,
      [
        newProfileImagePath || profileRows[0].profile_image,
        firstName,
        lastName,
        contactEmail,
        dateOfBirth,
        address,
        city,
        state,
        zipCode,
        shortDescription,
        longDescription,
        userId,
      ]
    );

    // ✅ Replace availability
    await connection.query("DELETE FROM user_availability WHERE user_id = ?", [
      userId,
    ]);
    await connection.query(
      "INSERT INTO user_availability (user_id, availability) VALUES (?, ?)",
      [userId, availability]
    );

    // ✅ Replace interests
    await connection.query("DELETE FROM user_interests WHERE user_id = ?", [
      userId,
    ]);

    const categoryIds = await Promise.all(
      JSON.parse(categories || "[]").map((c) =>
        insertInterest(connection, c, "category")
      )
    );

    const keywordIds = await Promise.all(
      JSON.parse(keywords || "[]").map((k) =>
        insertInterest(connection, k, "keyword")
      )
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

    await connection.commit();

    // 🧹 Delete old image file if new uploaded
    if (req.file && oldImagePath && fs.existsSync(oldImagePath)) {
      fs.unlink(oldImagePath, (err) => {
        if (err) console.error("❌ Failed to delete old image:", err);
        else console.log("🧹 Old profile image deleted.");
      });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    await connection.rollback();
    res.status(500).json({ message: "Update failed" });
  } finally {
    connection.release();
  }
};

exports.updatePremiumStatus = async (req, res) => {
  const { email, isPremium } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const [results] = await db.execute(
      "UPDATE users SET is_premium = ? WHERE email = ?",
      [isPremium ? 1 : 0, email]
    );

    if (results.affectedRows === 0)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: `Premium status updated to ${isPremium}` });
  } catch (err) {
    console.error("❌ Update premium error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
