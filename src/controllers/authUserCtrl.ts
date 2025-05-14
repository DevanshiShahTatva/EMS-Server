import { Request, Response } from "express";
import {
  ApiResponse,
  create,
  findOne,
  getUserIdFromToken,
  throwError,
  updateOne,
  validateEmail,
} from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  resetPasswordSuccessMail,
  sendOtpToEmail,
  sendWelcomeEmail,
  sendOtpForEmailChange,
} from "../helper/nodemailer";
import User from "../models/signup.model";
import PointSettings from "../models/pointSetting.model";
import mongoose, { Types } from "mongoose";
import { deleteFromCloudinary, saveFileToCloud } from "../helper/cloudniry";
import crypto from 'crypto';
import { appLogger } from "../helper/logger";

dotenv.config();

const ensurePointSettings = async () => {
  const exists = await PointSettings.exists({});
  if (!exists) {
    await PointSettings.create({
      conversionRate: 10,
    });
  }
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const sort = { created: -1 };
    const body = req.body;
    const { name, email, password } = body;

    // empty field validation
    if (!name || !email || !password) {
      return throwError(
        res,
        "Please fill required data",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // validation for if email is exists
    const isEmailTaken = await findOne("User", { email: body.email }, sort);
    if (isEmailTaken) {
      return throwError(
        res,
        "Email has already been taken",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // bcrypt the password to store in db
    const salt = await bcryptjs.genSalt(10);
    const hashPassword = await bcryptjs.hash(body.password, salt);

    const newBody = {
      ...body,
      current_points: 0,
      current_badge: "Bronze",
      password: hashPassword,
    };

    rcResponse.data = await create("User", newBody);
    rcResponse.message = "You are register successfully.";
    sendWelcomeEmail(email, name);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const sort = { created: -1 };
    const body = req.body;
    const { email, password } = body;

    // empty field validation
    if (!email || !password) {
      return throwError(
        res,
        "Please fill required data",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // check is admin user login
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const adminUser = {
        name: "Event Manager",
        email: "admin@evently.com",
        role: "admin",
      };

      const token = jwt.sign(adminUser, process.env.TOKEN_SECRET!, {
        expiresIn: "1d",
      });

      const userDataWithToken = {
        ...adminUser,
        token: token,
      };
      rcResponse.data = userDataWithToken;
      rcResponse.message = "You have login successfully.";
      await ensurePointSettings();
      return res.status(rcResponse.status).send(rcResponse);
    }
    // Staff Login (to validate tickets) 
    else if (
      email === process.env.STAFF_EMAIL &&
      password === process.env.STAFF_PASSWORD
    ) {
      const staffUser = {
        name: "Event Staff",
        email: "staff@evently.com",
        role: "staff",
      };

      const token = jwt.sign(staffUser, process.env.TOKEN_SECRET!, {
        expiresIn: "1d",
      });

      const userDataWithToken = {
        ...staffUser,
        token: token,
      };
      rcResponse.data = userDataWithToken;
      rcResponse.message = "You have login successfully.";
      return res.status(rcResponse.status).send(rcResponse);
    } else {
      // validation for if email is exists
      const findUser = await findOne("User", { email: email }, sort);
      if (!findUser) {
        return throwError(res, "Email not found", HTTP_STATUS_CODE.NOT_FOUND);
      }

      // encrypt the password
      const isValidPassword = await bcryptjs.compare(
        password,
        findUser.password
      );

      if (!isValidPassword) {
        return throwError(
          res,
          "Invalid Password",
          HTTP_STATUS_CODE.BAD_REQUEST
        );
      }

      const tokenUser = {
        _id: findUser._id,
        name: findUser.name,
        email: findUser.email,
        role: "user",
      };

      const token = jwt.sign(tokenUser, process.env.TOKEN_SECRET!, {
        expiresIn: "1d",
      });

      const userDataWithToken = {
        ...tokenUser,
        token: token,
      };
      rcResponse.data = userDataWithToken;
      rcResponse.message = "You have login successfully.";
      return res.status(rcResponse.status).send(rcResponse);
    }
  } catch (err) {
    return throwError(res);
  }
};

export const forgotPassword = async (req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    const { email } = req.body;

    const findUser = await findOne("User", { email: email });
    if (!findUser) {
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    let otp = Math.random();
    otp = Math.floor(100000 + Math.random() * 900000);

    await updateOne(
      "User",
      { email: email },
      { otp: otp, otp_expiry: Date.now() + 5 * 60 * 1000 }
    );
    rcResponse.data = { email: email };
    await sendOtpToEmail(email, otp, findUser.name);
    rcResponse.message = "Otp send successfully to your email";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const resetPassword = async (req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    const { email, otp, password } = req.body;

    const findUser = await findOne("User", { email: email });
    if (!findUser) {
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // check otp expiry
    if (Date.now() > findUser.otp_expiry) {
      return throwError(
        res,
        "OTP has expired or it's already been used",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // verify otp
    if (otp !== findUser.otp) {
      return throwError(res, "Incorrect OTP", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // check password is same or not
    const isSamePassword = await bcryptjs.compare(password, findUser.password);

    if (isSamePassword) {
      return throwError(
        res,
        "Password must be different form previous password",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // password to hash password
    const salt = await bcryptjs.genSalt(10);
    const hashPassword = await bcryptjs.hash(password, salt);

    rcResponse.data = await updateOne(
      "User",
      { email: email },
      { otp: "", otp_expiry: null, password: hashPassword }
    );

    rcResponse.message = "Password has been changed successfully";
    resetPasswordSuccessMail(email, findUser.name);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    rcResponse.message = "You have logout successfully";
    rcResponse.data = null;
    return res.clearCookie("token").status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const users = await User.find();
    rcResponse.data = users;
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const userDetails = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);

    const pipeline: any[] = [
      { $match: { _id: new Types.ObjectId(userId) } },
      { $project: { _id: 1, name: 1, email: 1, profileimage: 1, current_points: 1, total_earned_points: 1, current_badge: 1, address: 1, country: 1, state: 1, city: 1, zipcode: 1, latitude: 1, longitude: 1 } },
    ];

    rcResponse.data = await User.aggregate(pipeline);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const settingResetPassword = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const { newPassword } = req.body;

    const pipeline: any[] = [
      { $match: { _id: new Types.ObjectId(userId) } },
      { $project: { _id: 0, _v: 0 } },
    ];

    const currentUser = (await User.aggregate(pipeline)) as any;

    const isBothPasswordSame = await bcryptjs.compare(
      newPassword,
      currentUser[0].password
    );

    if (isBothPasswordSame) {
      return throwError(res, "Old and new password must be difference", 400);
    }

    // bcrypt the password to store in db
    const salt = await bcryptjs.genSalt(10);
    const hashPassword = await bcryptjs.hash(newPassword, salt);

    currentUser[0].password = hashPassword;

    rcResponse.data = await updateOne("User", { _id: userId }, currentUser[0]);
    rcResponse.message = "Your password has been successfully changed.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const settingResetEmail = async (req: Request, res: Response) => {
  const log = appLogger.child({
    method: 'settingResetEmail',
    userId: getUserIdFromToken(req)
  });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const { email } = req.body;


    // Validate input
    if (!email || !validateEmail(email)) {
      return throwError(res, "Valid email required", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // Check if email is already used by another user
    const existingUser = await User.findOne({ email: new RegExp(`^${email}$`, 'i') }).session(session);
    if (existingUser && existingUser._id.toString() !== userId) {
      return throwError(res, "Email already in use", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // Get user safely
    const user = await User.findById(userId).session(session);
    if (!user) {
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // Case-insensitive comparison
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return throwError(res, "New email must be different", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // Generate secure OTP
    const otp = crypto.randomInt(100000, 999999);
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Update user
    await User.findByIdAndUpdate(
      userId,
      { email_otp: otp, email_otp_expiry: expiry },
      { session }
    );

    
    await session.commitTransaction();

    // MAIL SERVICE
    await sendOtpForEmailChange(email, otp, user.name);

    rcResponse.data = { email };
    rcResponse.message = "OTP sent successfully";
    return res.status(rcResponse.status).send(rcResponse);

  } catch (error) {
    log.error({ err: error }, 'Error in email reset process');
    await session.abortTransaction();
    return throwError(res, "Email change failed", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  } finally {
    session.endSession();
    // log.debug('Session ended');
  }
};

export const settingVerifyEmail = async (req: Request, res: Response) => {
  const log = appLogger.child({
    method: 'settingVerifyEmail',
    userId: getUserIdFromToken(req)
  });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const { email, otp } = req.body;

    // 1. Validate input
    if (!email || !otp || !validateEmail(email)) {
      return throwError(res, "Invalid input", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // 2. Check if email exists (case-insensitive)
    const emailExists = await User.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      _id: { $ne: new Types.ObjectId(userId) }
    }).session(session);

    if (emailExists) {
      // log.warn('Email already in use', { email });
      return throwError(res, "Email already in use", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // 3. Get current user
    const user = await User.findById(userId).session(session);
    if (!user) {
      // log.warn('User not found', { userId });
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // 4. Verify OTP
    if (!user.email_otp || Date.now() > user.email_otp_expiry) {
      return throwError(res, "OTP expired", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    if (String(otp) !== String(user.email_otp)) {
      return throwError(res, "Invalid OTP", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // 5. Update email
    await User.findByIdAndUpdate(
      userId,
      {
        $set: { email: email.toLowerCase() }, // Normalize to lowercase
        $unset: { email_otp: "", email_otp_expiry: "" }
      },
      { session }
    );

    await session.commitTransaction();

    rcResponse.message = "Email updated successfully";
    return res.status(rcResponse.status).send(rcResponse);

  } catch (error: any) {
    await session.abortTransaction();

    if (error.code === 11000) {
      log.error('Duplicate email error', { error });
      return throwError(res, "Email already in use", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    log.error({ err: error }, 'Email verification failed');
    return throwError(
      res,
      error.message || "Email verification failed",
      HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  } finally {
    session.endSession();
    // log.debug('Session ended');
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const files = req.files as Express.Multer.File[];
    const data = req.body;

    const user = await findOne("User", { _id: new Types.ObjectId(userId) });

    if (!user) {
      return throwError(res, "User not found", 404);
    }

    let newData = {
      ...data,
    };

    if (files.length > 0) {
      if (user.profileimage && user.profileimage.imageId) {
        await deleteFromCloudinary(user.profileimage.imageId);
      }

      const imageUrl = await Promise.all(
        files.map((file) => saveFileToCloud(file))
      );

      newData = {
        ...data,
        profileimage: imageUrl[0],
      };
    } else if (data.deleteImage === "true") {
      if (user.profileimage?.imageId) {
        await deleteFromCloudinary(user.profileimage.imageId);
      }

      newData.profileimage = null;
    }

    rcResponse.data = await updateOne("User", { _id: userId }, newData);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("rerro", error);
    return throwError(res);
  }
};
