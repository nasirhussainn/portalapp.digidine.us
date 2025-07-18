const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const upload = require("../middlewares/multer");
const authMiddleware = require("../middlewares/auth");

router.post("/signup", upload.single("profileImage"), authController.signup);
router.get("/activate-account/:token", authController.activateAccount);
router.post("/resend-activation", authController.resendActivationEmail)
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.getCurrentUser);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout)
module.exports = router;
