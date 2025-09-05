const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const adminController = require("../controllers/adminController");

router.post("/login", adminController.login);
router.post("/forget-password", adminController.forgetPassword);
router.patch("/reset-password", auth, adminController.resetPassword);
router.get("/me", auth, adminController.getProfile);

module.exports = router;
