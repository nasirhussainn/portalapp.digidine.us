const fs = require("fs");
const path = require("path");
const db = require("../config/db");

exports.addKeywords = async (portfolioId, keywordList) => {
  const connection = await db.getConnection();
  const inserted = [];
  const ignored = [];

  try {
    await connection.beginTransaction();

    for (const kw of keywordList) {
      // Check if keyword already exists (case-sensitive match)
      const [existing] = await connection.query(
        "SELECT id FROM portfolio_keywords WHERE portfolio_id = ? AND BINARY keyword = ?",
        [portfolioId, kw]
      );

      if (existing.length > 0) {
        ignored.push(kw);
        continue;
      }

      await connection.query(
        "INSERT INTO portfolio_keywords (portfolio_id, keyword) VALUES (?, ?)",
        [portfolioId, kw]
      );
      inserted.push(kw);
    }

    await connection.commit();
    return { inserted, ignored };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.deleteKeywordById = async (keywordId) => {
  const connection = await db.getConnection();
  try {
    const [result] = await connection.query(
      "DELETE FROM portfolio_keywords WHERE id = ?",
      [keywordId]
    );

    return result.affectedRows > 0;
  } catch (err) {
    throw err;
  } finally {
    connection.release();
  }
};

