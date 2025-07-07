const portfolioService = require("../services/portfolioService");

exports.addPortfolio = (req, res, next) => portfolioService.addPortfolio(req, res, next);
exports.updatePortfolio = (req, res, next) => portfolioService.updatePortfolio(req, res, next);
exports.getAllPortfolios = (req, res, next) => portfolioService.getAllPortfolios(req, res, next);
exports.getPortfolioById = (req, res, next) => portfolioService.getPortfolioById(req, res, next);
exports.getPortfoliosByUser = (req, res, next) => portfolioService.getPortfoliosByUser(req, res, next);