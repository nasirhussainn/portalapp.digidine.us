const fs = require("fs");
const path = require("path");

exports.createUploadDir = () => {
  const dir = path.join(__dirname, "../uploads/profile_images");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

exports.insertInterest = async (connection, name, type) => {
  const table = type === "category" ? "categories" : "keywords";
  const [rows] = await connection.query(`SELECT id FROM ${table} WHERE name = ?`, [name]);
  if (rows.length > 0) return rows[0].id;

  const [result] = await connection.query(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
  return result.insertId;
};
