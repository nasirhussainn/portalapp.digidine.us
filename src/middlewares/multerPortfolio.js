const multer = require("multer");

const storage = multer.memoryStorage();

module.exports = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // Max 100MB
});
