const fs = require("fs");
const path = require("path");
const db = require("../config/db");

exports.addImages = async (portfolioId, imageFiles) => {
  const connection = await db.getConnection();
  const savedFiles = [];

  try {
    await connection.beginTransaction();

    for (const img of imageFiles) {
      if (!img.buffer) continue;

      const imgName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      const imgPath = `/uploads/portfolio_images/${imgName}`;
      const imgFullPath = path.join(__dirname, "..", imgPath);

      fs.writeFileSync(imgFullPath, img.buffer);
      savedFiles.push(imgPath);

      await connection.query(
        "INSERT INTO portfolio_images (portfolio_id, image) VALUES (?, ?)",
        [portfolioId, imgPath]
      );
    }

    await connection.commit();
    return savedFiles;
  } catch (err) {
    await connection.rollback();

    // Cleanup on error
    for (const file of savedFiles) {
      const fullPath = path.join(__dirname, "..", file);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    throw err;
  } finally {
    connection.release();
  }
};

exports.deleteImageById = async (imageId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ Get image path first
    const [rows] = await connection.query(
      "SELECT image FROM portfolio_images WHERE id = ?",
      [imageId]
    );

    if (!rows.length) {
      throw new Error("Image not found.");
    }

    const imagePath = path.join(__dirname, "..", rows[0].image);

    // ✅ Delete record from DB
    await connection.query("DELETE FROM portfolio_images WHERE id = ?", [
      imageId,
    ]);

    // ✅ Delete file from disk
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};
