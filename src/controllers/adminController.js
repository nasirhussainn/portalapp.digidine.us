const adminService = require("../services/adminService");

exports.login = (req, res, next) => adminService.login(req, res, next);
exports.forgetPassword = (req, res, next) => adminService.forgetPassword(req, res, next);
exports.resetPassword = (req, res, next) => adminService.resetPassword(req, res, next);
exports.getProfile = (req, res, next) => adminService.getProfile(req, res, next);
