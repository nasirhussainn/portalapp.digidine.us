const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");
const upload = require("../middlewares/multer");

router.get("/get-single", accountController.getSingleUser);
router.get("/get-all", accountController.getAllUsers);
router.get("/get-premium-users", accountController.getPremiumUsers);
router.delete("/delete/:user_id", accountController.deleteAccount);
router.put("/update-profile", upload.single("profileImage"), accountController.updateProfile);
router.patch("/update-premium-status", accountController.updatePremiumStatus);
router.patch(`/account/update-status/:userId`, accountController.updateUserStatus);
module.exports = router;
