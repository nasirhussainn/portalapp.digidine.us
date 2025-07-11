const express = require("express");
const router = express.Router();
const portfolioKeywordController = require("../controllers/portfolioKeywordController");

router.post("/keywords", portfolioKeywordController.addPortfolioKeywords);
router.delete("/keywords/:keyword_id", portfolioKeywordController.deletePortfolioKeyword);

module.exports = router;