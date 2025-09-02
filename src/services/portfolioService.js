const db = require("../config/db");
const fs = require("fs");
const path = require("path");

exports.addPortfolio = async (req, res) => {
  const { user_id, title, description, keywords } = req.body;
  const videoFile = req.files?.video?.[0];
  const imageFiles = req.files?.images || [];
  const supportingDoc = req.files?.supporting_document?.[0]; 

  if (!user_id || !title) {
    return res.status(400).json({ message: "User ID and title are required." });
  }

  if (!supportingDoc || !supportingDoc.buffer) {
    return res.status(400).json({ message: "Supporting document is required." });
  }

  const connection = await db.getConnection();
  const savedFiles = []; // Track files for rollback

  try {
    await connection.beginTransaction();

    // ✅ Validate user exists
    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );
    if (!userRows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const userId = userRows[0].id;

    // ✅ Prepare paths (but do NOT write yet)
    let videoPath = null;
    let videoFullPath = null;

    if (videoFile && videoFile.buffer) {
      const videoName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
      videoPath = `/uploads/portfolio_videos/${videoName}`;
      videoFullPath = path.join(__dirname, "..", videoPath);
    }

    // ✅ Supporting document
    const docName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(supportingDoc.originalname)}`;
    const docPath = `/uploads/supporting_docs/${docName}`;
    const docFullPath = path.join(__dirname, "..", docPath);

    // ✅ Insert portfolio with status = pending
    const [portfolioResult] = await connection.query(
      `INSERT INTO user_portfolio (user_id, title, description, status, video, supporting_document) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title, description || null, "pending", videoPath, docPath]
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

    // ✅ Save images & insert
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

    // ✅ Commit transaction first
    await connection.commit();

    // ✅ After DB commit, write video & supporting document
    if (videoFullPath && videoFile.buffer) {
      fs.writeFileSync(videoFullPath, videoFile.buffer);
      savedFiles.push(videoFullPath);
    }

    fs.writeFileSync(docFullPath, supportingDoc.buffer);
    savedFiles.push(docFullPath);

    return res.json({
      message: "Portfolio added successfully.",
      portfolio_id: portfolioId,
      status: "pending"
    });

  } catch (err) {
    console.error("❌ Portfolio add error:", err);
    await connection.rollback();

    // Rollback any saved files
    for (const file of savedFiles) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    return res.status(500).json({ message: "Failed to add portfolio." });
  } finally {
    connection.release();
  }
};


exports.updatePortfolio = async (req, res) => {
  const { portfolio_id, title, description } = req.body;
  const videoFile = req.files?.video?.[0];
  const supportingDoc = req.files?.supporting_document?.[0]; 

  if (!portfolio_id || !title) {
    return res.status(400).json({ message: "Portfolio ID and title are required." });
  }

  const connection = await db.getConnection();
  const savedFiles = [];

  try {
    await connection.beginTransaction();

    // ✅ Fetch existing portfolio
    const [portfolioRows] = await connection.query(
      "SELECT * FROM user_portfolio WHERE id = ?",
      [portfolio_id]
    );
    if (!portfolioRows.length) {
      return res.status(404).json({ message: "Portfolio not found." });
    }

    const portfolio = portfolioRows[0];
    const currentStatus = portfolio.status;

    // ✅ Check update rules
    if (currentStatus === "approved") {
      // Check last update time
      const lastUpdated = new Date(portfolio.updated_at);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      if (lastUpdated > oneWeekAgo) {
        return res.status(403).json({
          message: "Approved portfolio can only be updated once per week."
        });
      }
    }

    // ✅ Old file paths for cleanup if replaced
    const oldVideoPath = portfolio.video ? path.join(__dirname, "..", portfolio.video) : null;
    const oldDocPath = portfolio.supporting_document
      ? path.join(__dirname, "..", portfolio.supporting_document)
      : null;

    // ✅ Prepare new video path if uploaded
    let newVideoPath = portfolio.video || null;
    let newVideoFullPath = null;

    if (videoFile?.buffer) {
      const videoName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
      newVideoPath = `/uploads/portfolio_videos/${videoName}`;
      newVideoFullPath = path.join(__dirname, "..", newVideoPath);
    }

    // ✅ Prepare new supporting document if uploaded
    let newDocPath = portfolio.supporting_document || null;
    let newDocFullPath = null;

    if (supportingDoc?.buffer) {
      const docName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(supportingDoc.originalname)}`;
      newDocPath = `/uploads/supporting_docs/${docName}`;
      newDocFullPath = path.join(__dirname, "..", newDocPath);
    }

    // ✅ Update portfolio (reset status to pending)
    await connection.query(
      "UPDATE user_portfolio SET title = ?, description = ?, video = ?, supporting_document = ?, status = ?, updated_at = NOW() WHERE id = ?",
      [title, description || null, newVideoPath, newDocPath, "pending", portfolio_id]
    );

    await connection.commit();

    // ✅ Save new video if uploaded
    if (newVideoFullPath && videoFile?.buffer) {
      fs.writeFileSync(newVideoFullPath, videoFile.buffer);
      savedFiles.push(newVideoFullPath);
    }

    // ✅ Save new document if uploaded
    if (newDocFullPath && supportingDoc?.buffer) {
      fs.writeFileSync(newDocFullPath, supportingDoc.buffer);
      savedFiles.push(newDocFullPath);
    }

    // ✅ Delete old files only if replaced
    if (videoFile?.buffer && oldVideoPath && fs.existsSync(oldVideoPath)) {
      fs.unlinkSync(oldVideoPath);
    }
    if (supportingDoc?.buffer && oldDocPath && fs.existsSync(oldDocPath)) {
      fs.unlinkSync(oldDocPath);
    }

    return res.json({
      message: "Portfolio updated successfully. Status set to pending for re-approval."
    });

  } catch (err) {
    console.error("❌ Update portfolio error:", err);
    await connection.rollback();

    // Rollback any new files
    for (const f of savedFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    return res.status(500).json({ message: "Failed to update portfolio." });
  } finally {
    connection.release();
  }
};


exports.getAllPortfolios = async (req, res) => {
  const { premium, status, page = 1, limit = 10 } = req.query;

  const isPremiumFilter = premium === "true";
  const hasStatusFilter = status && ["Pending", "Approved", "Rejected"].includes(status);

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const connection = await db.getConnection();
  try {
    // ✅ Build WHERE conditions dynamically
    let whereClause = "";
    let conditions = [];

    if (isPremiumFilter) {
      whereClause += "JOIN users u ON p.user_id = u.id WHERE u.is_premium = TRUE";
    }

    if (hasStatusFilter) {
      whereClause += isPremiumFilter ? " AND" : " WHERE";
      whereClause += " p.status = ?";
      conditions.push(status);
    }

    // 🔹 Count total matching portfolios
    const [countRows] = await connection.query(
      `
      SELECT COUNT(*) AS total 
      FROM user_portfolio p 
      ${whereClause}
    `,
      conditions
    );
    const total = countRows[0].total;

    // 🔹 Fetch paginated portfolios
    const [portfolios] = await connection.query(
      `
      SELECT 
        p.id AS portfolio_id,
        p.user_id,
        p.title,
        p.description,
        p.status,
        p.video,
        p.supporting_document,
        p.created_at,
        p.updated_at
      FROM user_portfolio p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...conditions, parseInt(limit), offset]
    );

    // 🔹 Fetch images and keywords for each portfolio
    for (const portfolio of portfolios) {
      if (portfolio.video) {
        portfolio.video = process.env.CLIENT_URL + portfolio.video;
      }

       // 🔹 Supporting Document URL (if available)
       if (portfolio.supporting_document) {
        portfolio.supporting_document = process.env.CLIENT_URL + portfolio.supporting_document;
      }

      // ✅ Get image ID + path
      const [images] = await connection.query(
        `SELECT id, image FROM portfolio_images WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_images = images.map((img) => ({
        id: img.id,
        url: process.env.CLIENT_URL + img.image,
      }));

      // ✅ Get keyword ID + value
      const [keywords] = await connection.query(
        `SELECT id, keyword FROM portfolio_keywords WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_keywords = keywords.map((k) => ({
        id: k.id,
        keyword: k.keyword,
      }));
    }

    res.json({
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: portfolios,
    });
  } catch (error) {
    console.error("❌ Get all portfolios error:", error);
    res.status(500).json({ message: "Failed to fetch portfolios" });
  } finally {
    connection.release();
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
         status,
         video,
         supporting_document,
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

    if (portfolio.video) {
      portfolio.video = process.env.CLIENT_URL + portfolio.video;
    }

     // 🔹 Supporting Document URL (if available)
     if (portfolio.supporting_document) {
      portfolio.supporting_document = process.env.CLIENT_URL + portfolio.supporting_document;
    }

    // 🔹 Fetch images (with ID + path)
    const [images] = await db.execute(
      `SELECT id, image FROM portfolio_images WHERE portfolio_id = ?`,
      [portfolio.portfolio_id]
    );
    portfolio.portfolio_images = images.map((img) => ({
      id: img.id,
      url: process.env.CLIENT_URL + img.image
    }));

    // 🔹 Fetch keywords (with ID + keyword)
    const [keywords] = await db.execute(
      `SELECT id, keyword FROM portfolio_keywords WHERE portfolio_id = ?`,
      [portfolio.portfolio_id]
    );
    portfolio.portfolio_keywords = keywords.map((k) => ({
      id: k.id,
      keyword: k.keyword
    }));

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
         status,
         supporting_document,
         created_at,
         updated_at
       FROM user_portfolio
       WHERE user_id = ?`,
      [userId]
    );

    for (const portfolio of portfolios) {
      // 🔹 Video URL
      if (portfolio.video) {
        portfolio.video = process.env.CLIENT_URL + portfolio.video;
      }

      // 🔹 Supporting Document URL (if available)
      if (portfolio.supporting_document) {
        portfolio.supporting_document = process.env.CLIENT_URL + portfolio.supporting_document;
      }

      // 🔹 Fetch images with ID + path
      const [images] = await db.execute(
        `SELECT id, image FROM portfolio_images WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_images = images.map((img) => ({
        id: img.id,
        url: process.env.CLIENT_URL + img.image
      }));

      // 🔹 Fetch keywords with ID + keyword
      const [keywords] = await db.execute(
        `SELECT id, keyword FROM portfolio_keywords WHERE portfolio_id = ?`,
        [portfolio.portfolio_id]
      );
      portfolio.portfolio_keywords = keywords.map((k) => ({
        id: k.id,
        keyword: k.keyword
      }));
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

    // 🔹 Get portfolio details (video & supporting document)
    const [portfolioRows] = await connection.query(
      `SELECT video, supporting_document FROM user_portfolio WHERE id = ?`,
      [portfolioId]
    );

    if (!portfolioRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Portfolio not found" });
    }

    const videoPath = portfolioRows[0].video
      ? path.join(__dirname, "..", portfolioRows[0].video)
      : null;

    const supportingDocPath = portfolioRows[0].supporting_document
      ? path.join(__dirname, "..", portfolioRows[0].supporting_document)
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

    // 🔹 Delete supporting document file
    if (supportingDocPath && fs.existsSync(supportingDocPath)) {
      fs.unlink(supportingDocPath, (err) => {
        if (err) console.error("❌ Failed to delete supporting document:", err);
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

    // 🔹 Collect image paths
    const [imageRows] = await connection.query(
      `SELECT image FROM portfolio_images WHERE portfolio_id IN (?)`,
      [portfolioIds]
    );
    const imagePaths = imageRows.map((row) =>
      path.join(__dirname, "..", row.image)
    );

    // 🔹 Collect supporting document paths
    const [docRows] = await connection.query(
      `SELECT document_path FROM portfolio_supporting_docs WHERE portfolio_id IN (?)`,
      [portfolioIds]
    );
    const docPaths = docRows.map((row) =>
      path.join(__dirname, "..", row.document_path)
    );

    // 🔹 Collect video paths
    const videoPaths = portfolios
      .map((p) => (p.video ? path.join(__dirname, "..", p.video) : null))
      .filter(Boolean);

    // 🔹 Delete related images
    await connection.query(
      `DELETE FROM portfolio_images WHERE portfolio_id IN (?)`,
      [portfolioIds]
    );

    // 🔹 Delete related supporting documents
    await connection.query(
      `DELETE FROM portfolio_supporting_docs WHERE portfolio_id IN (?)`,
      [portfolioIds]
    );

    // 🔹 Delete all user portfolios
    await connection.query(`DELETE FROM user_portfolio WHERE user_id = ?`, [
      userId,
    ]);

    await connection.commit();

    // 🔹 Delete all files after DB commit
    const deleteFiles = async (paths) => {
      await Promise.all(
        paths.map((filePath) => {
          return new Promise((resolve) => {
            if (fs.existsSync(filePath)) {
              fs.unlink(filePath, (err) => {
                if (err) console.error("❌ Failed to delete file:", err);
                resolve();
              });
            } else {
              resolve();
            }
          });
        })
      );
    };

    await deleteFiles(imagePaths);
    await deleteFiles(videoPaths);
    await deleteFiles(docPaths);

    res.json({ message: "All portfolios and related files deleted successfully." });
  } catch (err) {
    console.error("❌ Delete user portfolios error:", err);
    await connection.rollback();
    res.status(500).json({ message: "Failed to delete user portfolios." });
  } finally {
    connection.release();
  }
};


exports.deletePortfolioVideo = async (req, res) => {
  const portfolio_id = req.params.portfolio_id;

  if (!portfolio_id) {
    return res.status(400).json({ message: "Portfolio ID is required." });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ Check if portfolio exists
    const [rows] = await connection.query(
      "SELECT * FROM user_portfolio WHERE id = ?",
      [portfolio_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Portfolio not found." });
    }

    const currentVideoPath = rows[0].video
      ? path.join(__dirname, "..", rows[0].video)
      : null;

    // ✅ Update DB to remove video path
    await connection.query(
      "UPDATE user_portfolio SET video = NULL WHERE id = ?",
      [portfolio_id]
    );

    // ✅ Delete file from disk if it exists
    if (currentVideoPath && fs.existsSync(currentVideoPath)) {
      fs.unlinkSync(currentVideoPath);
    }

    await connection.commit();
    return res.json({ message: "Video deleted successfully." });
  } catch (err) {
    console.error("❌ Delete video error:", err);
    await connection.rollback();
    return res.status(500).json({ message: "Failed to delete video." });
  } finally {
    connection.release();
  }
};

