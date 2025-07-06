const fs = require("fs");
const path = require("path");
const db = require("../config/db");

exports.createUploadDir = () => {
  const dir = path.join(__dirname, "../uploads/profile_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/**
 * Inserts an interest (category or keyword) into the corresponding table if it doesn't already exist.
 * Returns the ID of the interest.
 *
 * @param {object} connection - The active DB connection
 * @param {string} name - The name of the interest (e.g., "Design")
 * @param {string} type - Either "category" or "keyword"
 * @returns {Promise<number>} - The ID of the interest
 */
exports.insertInterest = async (connection, name, type) => {
  if (!["category", "keyword"].includes(type)) {
    throw new Error("Invalid interest type");
  }

  const table = type === "category" ? "categories" : "keywords";
  const [rows] = await connection.query(`SELECT id FROM ${table} WHERE name = ?`, [name]);

  if (rows.length) {
    return rows[0].id;
  }

  const [insertResult] = await connection.query(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
  return insertResult.insertId;
};