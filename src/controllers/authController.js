const authService = require("../services/authService");

exports.signup = (req, res, next) => authService.signup(req, res, next);
exports.activateAccount = (req, res, next) => authService.activateAccount(req, res, next);
exports.resendActivationEmail = (req, res, next) => authService.resendActivationEmail(req, res, next);
exports.login = (req, res, next) => authService.login(req, res, next);
exports.getCurrentUser = (req, res, next) => authService.getCurrentUser(req, res, next);
exports.forgotPassword = (req, res, next) => authService.forgotPassword(req, res, next);
exports.resetPassword = (req, res, next) => authService.resetPassword(req, res, next);
exports.refreshToken = (req, res, next) => authService.refreshToken(req, res, next);
exports.logout = (req, res, next) => authService.logout(req, res, next);