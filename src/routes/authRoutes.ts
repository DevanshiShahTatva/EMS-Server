import { Router } from "express";
import {
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  logoutUser,
  userDetails,
  updateUser,
  settingResetPassword,
  settingResetEmail,
  settingVerifyEmail,
  getAllUsers,
  bulkUsersUpload,
  singleUserCreation,
  deleteUser,
} from "../controllers/authUserCtrl";
import { validateAdminToken, validateToken } from "../middlewares/checkToken";
import multer from "multer";

const upload = multer();
const authRoutes = Router();

authRoutes.post("/signup", registerUser);
authRoutes.post("/login", loginUser);
authRoutes.post("/forgot_password", forgotPassword);
authRoutes.post("/reset_password", resetPassword);
authRoutes.get("/logout", logoutUser);
authRoutes.get("/user_details", validateToken, userDetails);
authRoutes.put(
  "/update/user",
  validateToken,
  upload.array("profileimage", 1),
  updateUser
);
authRoutes.put("/reset_setting_password", validateToken, settingResetPassword);

// UPDATE USER EMAIL
authRoutes.put("/reset_setting_email", validateToken, settingResetEmail);
authRoutes.put("/verify_setting_email", validateToken, settingVerifyEmail);

// ADMIN ONLY
authRoutes.get("/all_users", validateAdminToken, getAllUsers);

// Bulk User Upload
authRoutes.post("/admin/bulk-uploads", validateAdminToken, upload.single("file"), bulkUsersUpload)

// Single User Creation
authRoutes.post("/admin/single-user-creation", validateAdminToken, singleUserCreation)

// User deletion
authRoutes.delete("/admin/delete-user/:id", validateAdminToken, deleteUser)

export default authRoutes;
