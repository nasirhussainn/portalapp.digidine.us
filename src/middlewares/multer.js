const multer = require("multer");

// Use memory storage to avoid premature disk writes
const storage = multer.memoryStorage();

module.exports = multer({ storage });
