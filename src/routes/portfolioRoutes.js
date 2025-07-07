const express = require("express");
const router = express.Router();
const portfolioController = require("../controllers/portfolioController");
const upload = require("../middlewares/multerPortfolio");

router.post(
  "/add",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  portfolioController.addPortfolio
);

router.put(
  "/update",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "images", maxCount: 10 },
  ]),
  portfolioController.updatePortfolio
);

router.get("/get-all", portfolioController.getAllPortfolios);
router.get("/get-by-id/:portfolio_id", portfolioController.getPortfolioById);
router.get("/get-by-user/:user_id", portfolioController.getPortfoliosByUser);

module.exports = router;
