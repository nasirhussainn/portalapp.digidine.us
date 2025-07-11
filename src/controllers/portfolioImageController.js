const portfolioImageService = require("../services/portfolioImageService");

exports.addPortfolioImages = async (req, res) => {
  const { portfolio_id } = req.body;
  const imageFiles = req.files?.images || [];

  if (!portfolio_id || !imageFiles.length) {
    return res
      .status(400)
      .json({ message: "Portfolio ID and at least one image are required." });
  }

  try {
    const result = await portfolioImageService.addImages(
      portfolio_id,
      imageFiles
    );
    return res.json({ message: "Images added successfully.", files: result });
  } catch (err) {
    console.error("❌ Add images error:", err);
    return res.status(500).json({ message: "Failed to add images." });
  }
};

exports.deletePortfolioImage = async (req, res) => {
  const imageId = req.params.image_id;

  if (!imageId) {
    return res.status(400).json({ message: "Image ID is required." });
  }

  try {
    await portfolioImageService.deleteImageById(imageId);
    return res.json({ message: "Image deleted successfully." });
  } catch (err) {
    console.error("❌ Delete image error:", err);
    return res.status(500).json({ message: "Failed to delete image." });
  }
};
