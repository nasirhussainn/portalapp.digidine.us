const express = require("express");
const router = express.Router();
const portfolioImageController = require("../controllers/portfolioImageController");
const upload = require("../middlewares/multerPortfolio");

router.post(
  "/images",
  upload.fields([{ name: "images", maxCount: 10 }]),
  portfolioImageController.addPortfolioImages
);

router.delete("/images/:image_id", portfolioImageController.deletePortfolioImage);


module.exports = router;
