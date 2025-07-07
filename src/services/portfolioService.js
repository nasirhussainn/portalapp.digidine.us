const db = require("../config/db");
const fs = require("fs");
const path = require("path");

exports.addPortfolio = async (req, res) => {
  const { user_id, title, description, keywords } = req.body;
  const videoFile = req.files?.video?.[0];
  const imageFiles = req.files?.images || [];

  if (!user_id || !title) {
    return res.status(400).json({ message: "User ID and title are required." });
  }

  const connection = await db.getConnection();
  const savedFiles = []; // 🧹 track saved files in case of rollback

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );
    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const userId = userRows[0].id;

    // Delay video write until DB is successful
    let videoPath = null;
    let videoFullPath = null;

    if (videoFile && videoFile.buffer) {
      const videoName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
      videoPath = `/uploads/portfolio_videos/${videoName}`;
      videoFullPath = path.join(__dirname, "..", videoPath);
    }

    const [portfolioResult] = await connection.query(
      `INSERT INTO user_portfolio (user_id, title, description, video) VALUES (?, ?, ?, ?)`,
      [userId, title, description || null, videoPath]
    );

    const portfolioId = portfolioResult.insertId;

    // ✅ Insert keywords
    const parsedKeywords = JSON.parse(keywords || "[]");
    for (const kw of parsedKeywords) {
      await connection.query(
        "INSERT INTO portfolio_keywords (portfolio_id, keyword) VALUES (?, ?)",
        [portfolioId, kw]
      );
    }

    // ✅ Write and insert images
    for (const img of imageFiles) {
      if (!img.buffer) continue;

      const imgName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const imgPath = `/uploads/portfolio_images/${imgName}`;
      const imgFullPath = path.join(__dirname, "..", imgPath);

      fs.writeFileSync(imgFullPath, img.buffer);
      savedFiles.push(imgFullPath);

      await connection.query(
        "INSERT INTO portfolio_images (portfolio_id, image) VALUES (?, ?)",
        [portfolioId, imgPath]
      );
    }

    // ✅ Now write video to disk (after DB commit)
    if (videoFullPath && videoFile.buffer) {
      fs.writeFileSync(videoFullPath, videoFile.buffer);
      savedFiles.push(videoFullPath);
    }

    await connection.commit();
    return res.json({ message: "Portfolio added successfully." });
  } catch (err) {
    console.error("❌ Portfolio add error:", err);
    await connection.rollback();

    // 🧹 Delete any saved files
    for (const file of savedFiles) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    return res.status(500).json({ message: "Failed to add portfolio." });
  } finally {
    connection.release();
  }
};

exports.updatePortfolio = async (req, res) => {
  const { portfolio_id, title, description, keywords } = req.body;
  const videoFile = req.files?.video?.[0];
  const imageFiles = req.files?.images || [];

  if (!portfolio_id || !title) {
    return res
      .status(400)
      .json({ message: "Portfolio ID and title are required." });
  }

  const connection = await db.getConnection();
  const savedFiles = [];

  try {
    await connection.beginTransaction();

    // ✅ Check if portfolio exists
    const [portfolioRows] = await connection.query(
      "SELECT * FROM user_portfolio WHERE id = ?",
      [portfolio_id]
    );
    if (!portfolioRows.length) {
      return res.status(404).json({ message: "Portfolio not found." });
    }

    const oldVideoPath = portfolioRows[0].video
      ? path.join(__dirname, "..", portfolioRows[0].video)
      : null;

    // ✅ Get old image paths to delete later
    const [oldImageRows] = await connection.query(
      "SELECT image FROM portfolio_images WHERE portfolio_id = ?",
      [portfolio_id]
    );
    const oldImagePaths = oldImageRows.map((row) =>
      path.join(__dirname, "..", row.image)
    );

    // ✅ Prepare new video path
    let newVideoPath = null;
    let newVideoFullPath = null;

    if (videoFile?.buffer) {
      const videoName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
      newVideoPath = `/uploads/portfolio_videos/${videoName}`;
      newVideoFullPath = path.join(__dirname, "..", newVideoPath);
    }

    // ✅ Update portfolio main info
    await connection.query(
      "UPDATE user_portfolio SET title = ?, description = ?, video = ? WHERE id = ?",
      [title, description || null, newVideoPath, portfolio_id]
    );

    // ✅ Delete old keywords and insert new
    await connection.query(
      "DELETE FROM portfolio_keywords WHERE portfolio_id = ?",
      [portfolio_id]
    );

    const parsedKeywords = JSON.parse(keywords || "[]");
    for (const kw of parsedKeywords) {
      await connection.query(
        "INSERT INTO portfolio_keywords (portfolio_id, keyword) VALUES (?, ?)",
        [portfolio_id, kw]
      );
    }

    // ✅ Delete old image records
    await connection.query(
      "DELETE FROM portfolio_images WHERE portfolio_id = ?",
      [portfolio_id]
    );

    // ✅ Insert new image records and store files
    for (const img of imageFiles) {
      if (!img.buffer) continue;

      const imgName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const imgPath = `/uploads/portfolio_images/${imgName}`;
      const imgFullPath = path.join(__dirname, "..", imgPath);

      fs.writeFileSync(imgFullPath, img.buffer);
      savedFiles.push(imgFullPath);

      await connection.query(
        "INSERT INTO portfolio_images (portfolio_id, image) VALUES (?, ?)",
        [portfolio_id, imgPath]
      );
    }

    // ✅ Now save video file (after DB insert succeeds)
    if (newVideoFullPath && videoFile?.buffer) {
      fs.writeFileSync(newVideoFullPath, videoFile.buffer);
      savedFiles.push(newVideoFullPath);
    }

    await connection.commit();

    // 🧹 Delete old files from disk (only after successful commit)
    if (oldVideoPath && fs.existsSync(oldVideoPath)) {
      fs.unlinkSync(oldVideoPath);
    }

    for (const oldImgPath of oldImagePaths) {
      if (fs.existsSync(oldImgPath)) {
        fs.unlinkSync(oldImgPath);
      }
    }

    return res.json({ message: "Portfolio updated successfully." });
  } catch (err) {
    console.error("❌ Update portfolio error:", err);
    await connection.rollback();

    // 🧹 Clean up newly saved files on failure
    for (const f of savedFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    return res.status(500).json({ message: "Failed to update portfolio." });
  } finally {
    connection.release();
  }
};

exports.getAllPortfolios = async (req, res) => {
  try {
    const [portfolios] = await db.execute(`
        SELECT 
          id AS portfolio_id,
          user_id,
          title,
          description,
          video,
          created_at,
          updated_at
        FROM user_portfolio
      `);

    for (const portfolio of portfolios) {
      // 🔹 Fetch images
      const [images] = await db.execute(
        `SELECT image FROM portfolio_images WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_images = images.map((img) => img.image);

      // 🔹 Fetch keywords
      const [keywords] = await db.execute(
        `SELECT keyword FROM portfolio_keywords WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_keywords = keywords.map((k) => k.keyword);
    }

    res.json({ data: portfolios });
  } catch (error) {
    console.error("❌ Get all portfolios error:", error);
    res.status(500).json({ message: "Failed to fetch portfolios" });
  }
};

exports.getPortfolioById = async (req, res) => {
  const portfolioId = req.params.portfolio_id;

  try {
    // 🔹 Fetch main portfolio
    const [rows] = await db.execute(
      `SELECT 
           id AS portfolio_id,
           user_id,
           title,
           description,
           video,
           created_at,
           updated_at
         FROM user_portfolio
         WHERE id = ?`,
      [portfolioId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Portfolio not found" });
    }

    const portfolio = rows[0];

    // 🔹 Fetch images
    const [images] = await db.execute(
      `SELECT image FROM portfolio_images WHERE portfolio_id = ?`,
      [portfolio.portfolio_id]
    );
    portfolio.portfolio_images = images.map((img) => img.image);

    // 🔹 Fetch keywords
    const [keywords] = await db.execute(
      `SELECT keyword FROM portfolio_keywords WHERE portfolio_id = ?`,
      [portfolio.portfolio_id]
    );
    portfolio.portfolio_keywords = keywords.map((k) => k.keyword);

    res.json({ data: portfolio });
  } catch (err) {
    console.error("❌ Get portfolio by ID error:", err);
    res.status(500).json({ message: "Failed to fetch portfolio" });
  }
};

exports.getPortfoliosByUser = async (req, res) => {
  const userId = req.params.user_id;

  try {
    // 🔹 Fetch all portfolios by user
    const [portfolios] = await db.execute(
      `SELECT 
           id AS portfolio_id,
           user_id,
           title,
           description,
           video,
           created_at,
           updated_at
         FROM user_portfolio
         WHERE user_id = ?`,
      [userId]
    );

    for (const portfolio of portfolios) {
      // 🔹 Fetch images
      const [images] = await db.execute(
        `SELECT image FROM portfolio_images WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_images = images.map((img) => img.image);

      // 🔹 Fetch keywords
      const [keywords] = await db.execute(
        `SELECT keyword FROM portfolio_keywords WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_keywords = keywords.map((k) => k.keyword);
    }

    res.json({ data: portfolios });
  } catch (err) {
    console.error("❌ Get portfolios by user error:", err);
    res.status(500).json({ message: "Failed to fetch portfolios" });
  }
};

exports.deletePortfolioById = async (req, res) => {
  const portfolioId = req.params.portfolio_id;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 🔹 Get video path
    const [portfolioRows] = await connection.query(
      `SELECT video FROM user_portfolio WHERE id = ?`,
      [portfolioId]
    );
    if (!portfolioRows.length) {
      return res.status(404).json({ message: "Portfolio not found" });
    }

    const videoPath = portfolioRows[0].video
      ? path.join(__dirname, "..", portfolioRows[0].video)
      : null;

    // 🔹 Get image paths
    const [imageRows] = await connection.query(
      `SELECT image FROM portfolio_images WHERE portfolio_id = ?`,
      [portfolioId]
    );
    const imagePaths = imageRows.map((row) =>
      path.join(__dirname, "..", row.image)
    );

    // 🔹 Delete portfolio (cascades to images & keywords)
    await connection.query(`DELETE FROM user_portfolio WHERE id = ?`, [
      portfolioId,
    ]);

    await connection.commit();

    // 🔹 Delete video file
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlink(videoPath, (err) => {
        if (err) console.error("❌ Failed to delete video:", err);
      });
    }

    // 🔹 Delete image files
    for (const imgPath of imagePaths) {
      if (fs.existsSync(imgPath)) {
        fs.unlink(imgPath, (err) => {
          if (err) console.error("❌ Failed to delete image:", err);
        });
      }
    }

    res.json({ message: "Portfolio deleted successfully." });
  } catch (err) {
    console.error("❌ Delete portfolio error:", err);
    await connection.rollback();
    res.status(500).json({ message: "Failed to delete portfolio." });
  } finally {
    connection.release();
  }
};

exports.deletePortfoliosByUser = async (req, res) => {
  const userId = req.params.user_id;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 🔹 Get all portfolio IDs of user
    const [portfolios] = await connection.query(
      `SELECT id, video FROM user_portfolio WHERE user_id = ?`,
      [userId]
    );

    if (!portfolios.length) {
      return res
        .status(404)
        .json({ message: "No portfolios found for this user." });
    }

    const portfolioIds = portfolios.map((p) => p.id);

    // 🔹 Collect all image paths
    const [imageRows] = await connection.query(
      `SELECT image FROM portfolio_images WHERE portfolio_id IN (?)`,
      [portfolioIds]
    );
    const imagePaths = imageRows.map((row) =>
      path.join(__dirname, "..", row.image)
    );

    // 🔹 Collect all video paths
    const videoPaths = portfolios
      .map((p) => (p.video ? path.join(__dirname, "..", p.video) : null))
      .filter(Boolean);

    // 🔹 Delete all user portfolios
    await connection.query(`DELETE FROM user_portfolio WHERE user_id = ?`, [
      userId,
    ]);

    await connection.commit();

    // 🔹 Delete videos
    for (const vidPath of videoPaths) {
      if (fs.existsSync(vidPath)) {
        fs.unlink(vidPath, (err) => {
          if (err) console.error("❌ Failed to delete video:", err);
        });
      }
    }

    // 🔹 Delete images
    for (const imgPath of imagePaths) {
      if (fs.existsSync(imgPath)) {
        fs.unlink(imgPath, (err) => {
          if (err) console.error("❌ Failed to delete image:", err);
        });
      }
    }

    res.json({ message: "All portfolios for the user deleted successfully." });
  } catch (err) {
    console.error("❌ Delete user portfolios error:", err);
    await connection.rollback();
    res.status(500).json({ message: "Failed to delete user portfolios." });
  } finally {
    connection.release();
  }
};
