const express = require("express");
const multer = require("multer");
const router = express.Router();
const { db, pool } = require('../config/db');

// Define multer storage for images and video
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define the route to add portfolio
router.post("/portfolio/add", upload.fields([{ name: "images", maxCount: 3 }, { name: "video", maxCount: 1 }]), async (req, res) => {
  try {
    const { user_id, title, description, keywords } = req.body;
    const images = req.files['images'] || [];
    const video = req.files['video'] ? req.files['video'][0] : null;
    
    // Convert keywords from comma-separated string to array
    const keywordArray = keywords ? keywords.split(',').map(kw => kw.trim()) : [];

    // Insert into user_portfolio table
    const portfolioResult = await new Promise((resolve, reject) => {
      const query = `INSERT INTO user_portfolio (user_id, title, description, image1, image2, image3, video) VALUES (?, ?, ?, ?, ?, ?, ?)`;

      // Prepare images as BLOBs or null if not provided
      const image1 = images[0] ? images[0].buffer : null;
      const image2 = images[1] ? images[1].buffer : null;
      const image3 = images[2] ? images[2].buffer : null;

      // Handle video as BLOB or URL path
      const videoData = video ? video.buffer : null;

      db.query(query, [user_id, title, description, image1, image2, image3, videoData], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    // Get the inserted portfolio ID
    const portfolioId = portfolioResult.insertId;

    // Insert keywords into portfolio_keywords table
    for (const keyword of keywordArray) {
      await new Promise((resolve, reject) => {
        const query = `INSERT INTO portfolio_keywords (portfolio_id, keyword) VALUES (?, ?)`;
        db.query(query, [portfolioId, keyword], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
    }

    res.status(201).json({ message: "Portfolio added successfully", portfolioId: portfolioId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add portfolio, please try again later" });
  }
});

router.delete("/portfolio/:id", async (req, res) => {
    const portfolioId = req.params.id;
  
    const connection = await pool.getConnection();
    try {
      // Start a transaction to ensure all queries are executed atomically
      await connection.beginTransaction();
  
      // Step 1: Delete associated keywords from portfolio_keywords
      await connection.query(
        "DELETE FROM portfolio_keywords WHERE portfolio_id = ?",
        [portfolioId]
      );
  
      // Step 2: Delete the portfolio itself from user_portfolio table
      const [portfolioResult] = await connection.query(
        "DELETE FROM user_portfolio WHERE portfolio_id = ?",
        [portfolioId]
      );
  
      if (portfolioResult.affectedRows === 0) {
        // If no rows were affected, it means the portfolio doesn't exist
        return res.status(404).json({ message: "Portfolio not found" });
      }
  
      // Step 3: Commit the transaction
      await connection.commit();
  
      res.json({ message: "Portfolio deleted successfully" });
  
    } catch (error) {
      console.error(error);
      // Rollback the transaction in case of error
      await connection.rollback();
      res.status(500).json({ message: "Failed to delete portfolio, please try again later" });
    } finally {
      // Always release the connection back to the pool
      connection.release();
    }
  });
  

// Export router
module.exports = router;

