const accountService = require("../services/accountService");

exports.getSingleUser = (req, res, next) => accountService.getSingleUser(req, res, next);
exports.getAllUsers = (req, res, next) => accountService.getAllUsers(req, res, next);
exports.getPremiumUsers = (req, res, next) => accountService.getPremiumUsers(req, res, next);
exports.deleteAccount = (req, res, next) => accountService.deleteAccount(req, res, next);
exports.updateProfile = (req, res, next) => accountService.updateProfile(req, res, next);
exports.updatePremiumStatus = (req, res, next) => accountService.updatePremiumStatus(req, res, next);
exports.updateUserStatus = (req, res, next) => accountService.updateUserStatus(req, res, next);
exports.updateProfileDetails = (req, res, next) => accountService.updateProfileDetails(req, res, next);


