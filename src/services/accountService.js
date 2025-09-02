const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const { insertInterest } = require("../utils/helpers");

const uploadDir = path.join(__dirname, "..", "uploads", "profile_images");

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] || // Real IP if behind proxy
    req.connection.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

exports.getSingleUser = async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const connection = await db.getConnection();
  try {
    // Get base user (non-sensitive fields)
    const [users] = await connection.query(
      "SELECT id, email, is_premium, is_active, created_at, updated_at FROM users WHERE email = ?",
      [email]
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
      userProfile.profile_image =
        process.env.CLIENT_URL + userProfile.profile_image;
    }

    // --------------------------- track user profile visit ------------------------ //
    const visitorIP = getClientIP(req);

    const isValidIP = (ip) =>
      typeof ip === "string" && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip);
    
    if (visitorIP && isValidIP(visitorIP)) {
      try {
        await connection.query(
          `INSERT IGNORE INTO profile_visits (user_id, visitor_ip) VALUES (?, ?)`,
          [user.id, visitorIP]
        );
      } catch (visitErr) {
        console.error("❌ Error logging profile visit:", visitErr.message);
      }
    }
    // ----------------------------------------------------------------------------- //

    res.json({
      ...user,
      profile: userProfile,
      interests: {
        categories,
        keywords,
      },
      experiences: experiences || [],
      education: education || [],
      pricing: pricing[0] || null  // Single pricing object or null
    });
  } catch (err) {
    console.error("❌ Get single user error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
};

exports.getAllUsers = async (req, res) => {
  const connection = await db.getConnection();

  try {
    let {
      is_active,
      is_premium,
      search_keyword,
      search_category,
      page = 1,
      limit = 10,
      ranked = false,
    } = req.query;

    const filters = [];
    const values = [];

    if (is_active !== undefined) {
      filters.push("is_active = ?");
      values.push(is_active === "true" || is_active === "1" ? 1 : 0);
    }

    if (is_premium !== undefined) {
      filters.push("is_premium = ?");
      values.push(is_premium === "true" || is_premium === "1" ? 1 : 0);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Step 1: Fetch filtered base users
    const [baseUsers] = await connection.query(
      `SELECT id, email, is_premium, is_active, created_at, updated_at 
       FROM users 
       ${whereClause}
       ORDER BY created_at DESC`,
      values
    );

    let filteredUsers = baseUsers;

    // Step 2: Further filter by category and keyword (if provided)
    if (search_keyword || search_category) {
      const userIdSet = new Set();

      if (search_keyword) {
        const [keywordUsers] = await connection.query(
          `SELECT DISTINCT ui.user_id 
           FROM user_interests ui
           JOIN keywords k ON ui.keyword_id = k.id
           WHERE LOWER(k.name) LIKE ?`,
          [`%${search_keyword.toLowerCase()}%`]
        );
        keywordUsers.forEach(row => userIdSet.add(row.user_id));
      }

      if (search_category) {
        const [categoryUsers] = await connection.query(
          `SELECT DISTINCT ui.user_id 
           FROM user_interests ui
           JOIN categories c ON ui.category_id = c.id
           WHERE LOWER(c.name) LIKE ?`,
          [`%${search_category.toLowerCase()}%`]
        );
        categoryUsers.forEach(row => userIdSet.add(row.user_id));
      }

      filteredUsers = baseUsers.filter(user => userIdSet.has(user.id));
    }

    // Step 3: Apply ranking if required
    if (ranked === "true" || ranked === true) {
      const userIds = filteredUsers.map(user => user.id);
      if (userIds.length === 0) {
        return res.json({
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0,
          users: [],
        });
      }

      const [rankedRows] = await connection.query(
        `SELECT user_id, COUNT(*) AS total_visits
         FROM profile_visits
         WHERE user_id IN (?)
         GROUP BY user_id
         ORDER BY total_visits DESC`,
        [userIds]
      );

      const rankedMap = new Map();
      rankedRows.forEach(row => rankedMap.set(row.user_id, row.total_visits));

      // Sort filteredUsers by visits
      filteredUsers = filteredUsers
        .filter(user => rankedMap.has(user.id))
        .sort((a, b) => rankedMap.get(b.id) - rankedMap.get(a.id))
        .map(user => ({
          ...user,
          total_visits: rankedMap.get(user.id),
        }));
    }

    // Step 4: Pagination
    const total = filteredUsers.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginatedUsers = filteredUsers.slice(offset, offset + parseInt(limit));

    // Step 5: Enrich user data with all new fields
    const enrichedUsers = await Promise.all(
      paginatedUsers.map(async (user) => {
        const [profile] = await connection.query(
          "SELECT * FROM user_profiles WHERE user_id = ?",
          [user.id]
        );

        // UPDATED:
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

        // ✅ Get user experiences (just count or basic info for listing)
        const [experiences] = await connection.query(
          `SELECT COUNT(*) as experience_count 
           FROM user_experience 
           WHERE user_id = ?`,
          [user.id]
        );

        // ✅ Get user education (just count for listing)
        const [education] = await connection.query(
          `SELECT COUNT(*) as education_count 
           FROM user_education 
           WHERE user_id = ?`,
          [user.id]
        );

        // ✅ Get user pricing (basic info)
        const [pricing] = await connection.query(
          `SELECT rate_type, hourly_rate, min_project_rate 
           FROM user_pricing 
           WHERE user_id = ?`,
          [user.id]
        );

        const userProfile = profile[0] || {};
        if (userProfile.profile_image) {
          userProfile.profile_image = process.env.CLIENT_URL + userProfile.profile_image;
        }

        return {
          ...user,
          profile: userProfile,
          interests: {
            categories,
            keywords,
          },
          // Add summary information for listing view
          stats: {
            experience_count: experiences[0]?.experience_count || 0,
            education_count: education[0]?.education_count || 0,
          },
          pricing: pricing[0] || null
        };
      })
    );

    res.json({
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      users: enrichedUsers,
    });

  } catch (err) {
    console.error("❌ Get all users error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
};


exports.getPremiumUsers = async (_, res) => {
  const connection = await db.getConnection();

  try {
    const [users] = await connection.query(
      `SELECT id, email, is_premium, is_active, created_at, updated_at 
       FROM users 
       WHERE is_premium = true`
    );

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [profile] = await connection.query(
          "SELECT * FROM user_profiles WHERE user_id = ?",
          [user.id]
        );

        // UPDATED: 
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

        // ✅ Get user experiences (just count for listing)
        const [experiences] = await connection.query(
          `SELECT COUNT(*) as experience_count 
           FROM user_experience 
           WHERE user_id = ?`,
          [user.id]
        );

        // ✅ Get user education (just count for listing)
        const [education] = await connection.query(
          `SELECT COUNT(*) as education_count 
           FROM user_education 
           WHERE user_id = ?`,
          [user.id]
        );

        // ✅ Get user pricing (basic info)
        const [pricing] = await connection.query(
          `SELECT rate_type, hourly_rate, min_project_rate 
           FROM user_pricing 
           WHERE user_id = ?`,
          [user.id]
        );

        const userProfile = profile[0] || {};
        if (userProfile.profile_image) {
          userProfile.profile_image =
            process.env.CLIENT_URL + userProfile.profile_image;
        }

        return {
          ...user,
          profile: userProfile,
          interests: {
            categories,
            keywords,
          },
          // Add summary information for premium users listing
          stats: {
            experience_count: experiences[0]?.experience_count || 0,
            education_count: education[0]?.education_count || 0,
          },
          pricing: pricing[0] || null
        };
      })
    );

    res.json(enrichedUsers);
  } catch (err) {
    console.error("❌ Get premium users error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
};

exports.deleteAccount = async (req, res) => {
  const userId = req.params.user_id;
  if (!userId) return res.status(400).json({ message: "User ID is required" });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // ✅ Check if user exists
    const [[user]] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    // 🔍 Get profile image to delete
    const [[profile]] = await connection.query(
      "SELECT profile_image FROM user_profiles WHERE user_id = ?",
      [userId]
    );
    const profileImagePath = profile?.profile_image
      ? path.join(__dirname, "..", profile.profile_image)
      : null;

    // 🔍 Get portfolio media paths
    const [portfolios] = await connection.query(
      "SELECT id, video FROM user_portfolio WHERE user_id = ?",
      [userId]
    );

    const videoPaths = portfolios
      .filter((p) => p.video)
      .map((p) => path.join(__dirname, "..", p.video));

    const portfolioIds = portfolios.map((p) => p.id);

    let imagePaths = [];
    if (portfolioIds.length > 0) {
      const [images] = await connection.query(
        `SELECT image FROM portfolio_images WHERE portfolio_id IN (?)`,
        [portfolioIds]
      );
      imagePaths = images
        .filter((img) => img.image)
        .map((img) => path.join(__dirname, "..", img.image));
    }

    // 🔍 Get additional file paths from new tables (if any)
    // Note: Currently, user_experience, user_education, and user_pricing 
    // don't store files, but we check for completeness

    // ❌ Delete user (cascades all related tables including new ones)
    // Due to ON DELETE CASCADE constraints, these will be automatically deleted:
    // - user_profiles
    // - user_interests
    // - user_portfolio (and portfolio_images, portfolio_keywords via cascade)
    // - profile_visits
    // - user_experience (NEW)
    // - user_education (NEW)
    // - user_pricing (NEW)
    await connection.query("DELETE FROM users WHERE id = ?", [userId]);

    await connection.commit();

    // 🧹 Delete all files from disk after DB commit
    const allPaths = [
      profileImagePath, 
      ...videoPaths, 
      ...imagePaths
    ].filter(path => path); // Remove null/undefined paths

    for (const filePath of allPaths) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error("❌ Failed to delete file:", filePath, err);
          else console.log("✅ Deleted file:", filePath);
        });
      }
    }

    res.json({
      message: "Account and all associated data deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete account error:", err);
    await connection.rollback();
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
    professional_headshot,
    professional_summary,
    availability,
    years_of_experience,
    categories,
    keywords,
    experiences,
    education,
    pricing
  } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const connection = await db.getConnection();
  let tempBuffer = null;
  let imageFilename = null;
  let newProfileImagePath = null;
  let oldImagePath = null;

  try {
    await connection.beginTransaction();

    // ✅ Fetch user details including status
    const [userRows] = await connection.query(
      "SELECT id, status FROM users WHERE email = ?",
      [email]
    );
    if (!userRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRows[0].id;
    const userStatus = userRows[0].status;

    // ✅ Get old profile image path
    const [profileRows] = await connection.query(
      "SELECT profile_image FROM user_profiles WHERE user_id = ?",
      [userId]
    );
    if (profileRows.length && profileRows[0].profile_image) {
      oldImagePath = path.join(__dirname, "..", profileRows[0].profile_image);
    }

    // ✅ Handle image upload (buffer only for now)
    if (req.file) {
      imageFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      newProfileImagePath = `/uploads/profile_images/${imageFilename}`;
      tempBuffer = req.file.buffer;
    }

    if (userStatus === "pending") {
      // ✅ If status is pending → Only allow profile image update
      if (!req.file) {
        return res.status(403).json({
          message: "Your profile is pending approval. Only profile image can be updated."
        });
      }

      await connection.query(
        `UPDATE user_profiles SET 
          profile_image = COALESCE(?, profile_image)
        WHERE user_id = ?`,
        [newProfileImagePath, userId]
      );

    } else {
      // ✅ If status is not pending → Allow full update
      await connection.query(
        `UPDATE user_profiles SET 
            profile_image = COALESCE(?, profile_image), 
            first_name = ?, last_name = ?, contact_email = ?, 
            date_of_birth = ?, address = ?, city = ?, state = ?, 
            professional_headshot = ?, professional_summary = ?,  
            availability = ?, years_of_experience = ?
          WHERE user_id = ?`,
        [
          newProfileImagePath,
          firstName,
          lastName,
          contactEmail,
          dateOfBirth,
          address,
          city,
          state,
          professional_headshot,
          professional_summary,
          availability,
          years_of_experience,
          userId,
        ]
      );

      // ✅ Replace interests
      await connection.query("DELETE FROM user_interests WHERE user_id = ?", [userId]);

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

      // ✅ Update experiences
      await connection.query("DELETE FROM user_experience WHERE user_id = ?", [userId]);
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

      // ✅ Update education
      await connection.query("DELETE FROM user_education WHERE user_id = ?", [userId]);
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

      // ✅ Update pricing (upsert)
      const pricingData = JSON.parse(pricing || "{}");
      if (pricingData.rate_type) {
        const [existingPricing] = await connection.query(
          "SELECT id FROM user_pricing WHERE user_id = ?",
          [userId]
        );

        if (existingPricing.length > 0) {
          await connection.query(
            `UPDATE user_pricing SET 
              rate_type = ?, hourly_rate = ?, min_project_rate = ?, 
              is_negotiable = ?, pricing_description = ?
              WHERE user_id = ?`,
            [
              pricingData.rate_type, pricingData.hourly_rate,
              pricingData.min_project_rate, pricingData.is_negotiable !== false,
              pricingData.pricing_description, userId
            ]
          );
        } else {
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
      }
    }

    await connection.commit();

    // ✅ Save image if uploaded
    if (tempBuffer && imageFilename) {
      const diskPath = path.join(__dirname, "..", "uploads", "profile_images", imageFilename);
      fs.writeFileSync(diskPath, tempBuffer);
    }

    // ✅ Delete old image if replaced
    if (req.file && oldImagePath && fs.existsSync(oldImagePath)) {
      fs.unlink(oldImagePath, (err) => {
        if (err) console.error("❌ Failed to delete old image:", err);
      });
    }

    res.json({
      message:
        userStatus === "pending"
          ? "Profile image updated successfully. Other details can be updated after approval."
          : "Profile updated successfully"
    });
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
