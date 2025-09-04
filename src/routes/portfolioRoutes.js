const express = require("express");
const router = express.Router();
const portfolioController = require("../controllers/portfolioController");
const upload = require("../middlewares/multerPortfolio");
const { max } = require("moment/moment");

router.post(
  "/add",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "supporting_document", maxCount: 1}
  ]),
  portfolioController.addPortfolio
);

router.put(
  "/update",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "images", maxCount: 10 },
    { name: "supporting_document", maxCount: 1}
  ]),
  portfolioController.updatePortfolio
);

router.get("/get-all", portfolioController.getAllPortfolios);
router.get("/get-by-id/:portfolio_id", portfolioController.getPortfolioById);
router.get("/get-by-user/:user_id", portfolioController.getPortfoliosByUser);
router.delete("/delete/:portfolio_id", portfolioController.deletePortfolioById);
router.delete("/delete-by-user/:user_id", portfolioController.deletePortfoliosByUser);

router.delete("/:portfolio_id/video", portfolioController.deletePortfolioVideo);

router.patch("/update-status/:portfolioId", portfolioController.updatePortfolioStatus);


module.exports = router;
