const portfolioKeywordService = require("../services/portfolioKeywordService");

exports.addPortfolioKeywords = async (req, res) => {
  const { portfolio_id, keywords } = req.body;

  if (!portfolio_id || !keywords) {
    return res
      .status(400)
      .json({ message: "Portfolio ID and keywords are required." });
  }

  try {
    let parsedKeywords = keywords;
    if (typeof keywords === "string") {
      parsedKeywords = JSON.parse(keywords);
    }

    if (!Array.isArray(parsedKeywords) || parsedKeywords.length === 0) {
      return res
        .status(400)
        .json({ message: "Keywords must be a non-empty array." });
    }

    const result = await portfolioKeywordService.addKeywords(
      portfolio_id,
      parsedKeywords
    );

    return res.json({
      message: `Added ${result.inserted.length} keyword${
        result.inserted.length !== 1 ? "s" : ""
      }. Skipped ${result.ignored.length} that already exist${
        result.ignored.length !== 1 ? "" : "s"
      }.`,
      added: result.inserted,
      skipped: result.ignored,
    });
  } catch (err) {
    console.error("❌ Add keywords error:", err);
    return res.status(500).json({ message: "Failed to add keywords." });
  }
};

exports.deletePortfolioKeyword = async (req, res) => {
  const keywordId = req.params.keyword_id;

  if (!keywordId) {
    return res.status(400).json({ message: "Keyword ID is required." });
  }

  try {
    const deleted = await portfolioKeywordService.deleteKeywordById(keywordId);

    if (!deleted) {
      return res.status(404).json({ message: "Keyword not found." });
    }

    return res.json({ message: "Keyword deleted successfully." });
  } catch (err) {
    console.error("❌ Delete keyword error:", err);
    return res.status(500).json({ message: "Failed to delete keyword." });
  }
};
