import { Request, Response } from "express";

// models
import User from "../models/signup.model";
import PointSettings from "../models/pointSetting.model";
import TicketBook from "../models/eventBooking.model";
import PointTransaction from "../models/pointTransaction";
import Voucher from "../models/voucher.model";


// helpers
import {
  ApiResponse,
  create,
  findOne,
  getUserIdFromToken,
  throwError,
  updateOne,
  validateEmail,
} from "../helper/common";
import {
  resetPasswordSuccessMail,
  sendOtpToEmail,
  sendWelcomeEmail,
  sendOtpForEmailChange,
  sendUserCreationEmail,
} from "../helper/nodemailer";
import { appLogger } from "../helper/logger";
import { deleteFromCloudinary, saveFileToCloud } from "../helper/cloudniry";
import { generateSecurePassword } from "../helper/generatePromoCode";
import { sendNotification } from "../services/notificationService";

// constatnt
import { HTTP_STATUS_CODE } from "../utilits/enum";

// library
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import mongoose, { Types } from "mongoose";
import crypto from 'crypto';
import csv from "csvtojson";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const rcResponse = new ApiResponse();
    const sort = { created: -1 };
    const body = req.body;
    const { name, email, password } = body;

    // empty field validation
    if (!name || !email || !password) {
      await session.abortTransaction();
      session.endSession();
      return throwError(
        res,
        "Please fill required data",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // validation for if email is exists
    const isEmailTaken = await findOne("User", { email: body.email }, sort);
    if (isEmailTaken) {
      await session.abortTransaction();
      session.endSession();
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
      password: hashPassword,
      current_points: 25,
      total_earned_points: 25,
      current_badge: "Bronze",
    };

    const user = new User(newBody);
    rcResponse.data = await user.save({ session });
    await PointTransaction.create([{
      userId: rcResponse.data._id,
      points: 25,
      activityType: 'EARN',
      description: `Welcome bonus points`,
    }],
      { session }
    );
    await session.commitTransaction();
    session.endSession();

    // send notification for update email
    const findAdminUser = await User.findOne({ role: "admin" });
    if (findAdminUser) {
      setImmediate(() => {
        sendNotification(findAdminUser._id, {
          title: `New ${body.role} register`,
          body: `${name} has been successfully registered as ${body.role}.`,
          data: {
            type: "admin_user"
          }
        });
      });
    };

    rcResponse.message = "You are register successfully.";
    sendWelcomeEmail(email, name);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
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

    const findUser = await findOne("User", { email: email }, sort);

    // check is admin user login
    if (findUser.role === "admin") {
      const adminUser = {
        _id: findUser._id,
        name: findUser.name,
        email: findUser.email,
        role: findUser.role || "admin",
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
    } else {
      // validation for if email is exists
      const findUser = await findOne("User", { email: email }, sort);
      if (!findUser) {
        return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
      }

      // encrypt the password
      const isValidPassword = await bcryptjs.compare(
        password,
        findUser.password
      );

      if (!isValidPassword) {
        return throwError(
          res,
          "Invalid Credentials",
          HTTP_STATUS_CODE.BAD_REQUEST
        );
      }

      const tokenUser = {
        _id: findUser._id,
        name: findUser.name,
        email: findUser.email,
        role: findUser.role || "user",
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
    console.log("ERROR", err);
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

export const uploadChatImage = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      return throwError(res, "No file uploaded.", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    const imageObj = await saveFileToCloud(file);

    return res.status(200).send({ imageObj });

  } catch (err) {
    console.log("Err:" + err);
    return throwError(res, "File upload failed", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
}

export const removeChatImage = async (req: Request, res: Response) => {
  try {
    const { imageId } = req.query;

    if (!imageId) {
      return throwError(res, "No imageId found!", HTTP_STATUS_CODE.BAD_REQUEST);
    }
    try {
      await deleteFromCloudinary(imageId as string);
    } catch (err) {
      console.log("Err:", err);
      return throwError(res, "Failed to delete image from Cloudinary", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
    }

    return res.status(200).send({ success: true });

  } catch (err) {
    console.log("Err:" + err);
    return throwError(res, "Failed to delete image from Cloudinary", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
}

export const bulkUsersUpload = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse()
    const file = req.file;

    if (!file) return throwError(res, "No file uploaded.", HTTP_STATUS_CODE.BAD_REQUEST)

    const ext = path.extname(file.originalname);
    let jsonArray: any[] = [];

    // Parse CSV or XLSX
    if (ext === ".csv") {
      jsonArray = await csv().fromString(file.buffer.toString());
    } else if (ext === ".xlsx") {
      const workbook = xlsx.read(file.buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonArray = xlsx.utils.sheet_to_json(worksheet);
    } else {
      return throwError(res, "Only .csv or .xlsx files are supported.", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    const uploadedArray: any[] = [];
    const errorArray: any[] = [];

    for (const item of jsonArray) {
      const { name, email, role } = item;
      const errorObj: any = {};
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!name || name.trim() === "") errorObj.name = "Name cannot be blank";
      if (!email || !emailRegex.test(email)) errorObj.email = "Valid Email required";
      if (!role || !["user", "organizer"].includes(role)) {
        errorObj.role = "Role must be 'user' or 'organizer'";
      }

      const existing = await User.findOne({ email });
      if (existing) errorObj.email = "Email already exists";

      if (Object.keys(errorObj).length > 0) {
        errorArray.push({ name, email, role, errors: errorObj });
        continue;
      }

      uploadedArray.push({ name, email, role });
    }

    if (errorArray.length === 0) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        for (const item of uploadedArray) {
          const plainPassword = generateSecurePassword(12);
          const salt = await bcryptjs.genSalt(10);
          const hashPassword = await bcryptjs.hash(plainPassword, salt);

          const newUserBody = {
            ...item,
            password: hashPassword,
            current_points: 25,
            total_earned_points: 25,
            current_badge: "Bronze",
          };

          const newUser = new User(newUserBody);
          const savedUser = await newUser.save({ session });

          await PointTransaction.create([{
            userId: savedUser._id,
            points: 25,
            activityType: 'EARN',
            description: `Welcome bonus points`,
          }], { session });

          // Send welcome email with plainPassword
          const { email, name, role } = newUserBody
          setImmediate(() => {
            sendUserCreationEmail(email, name, plainPassword, role)
          })
        }

        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }

    // Return unified response
    rcResponse.message = "Bulk upload completed";
    rcResponse.data = {
      uploaded: uploadedArray,
      errors: errorArray,
    };
    return res.status(rcResponse.status).send(rcResponse);

  } catch (error) {
    return throwError(res);
  }
}

export const singleUserCreation = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse()
    const { name, email, role } = req.body;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!name || !email || !role) return throwError(res, "All fields are required.", HTTP_STATUS_CODE.BAD_REQUEST)

    if (name.trim() === "") return throwError(res, "name can not be blank.", HTTP_STATUS_CODE.BAD_REQUEST)
    if (!["user", "organizer"].includes(role)) return throwError(res, "Role must be 'user' or 'organizer'.", HTTP_STATUS_CODE.BAD_REQUEST)
    if (!emailRegex.test(email)) return throwError(res, "Invalid Email Address", HTTP_STATUS_CODE.BAD_REQUEST)

    const existing = await User.findOne({ email });
    if (existing) return throwError(res, "Email already exists", HTTP_STATUS_CODE.BAD_REQUEST);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const plainPassword = generateSecurePassword(12);
      const salt = await bcryptjs.genSalt(10);
      const hashPassword = await bcryptjs.hash(plainPassword, salt);

      const newUserBody = {
        name,
        email,
        role,
        password: hashPassword,
        current_points: 25,
        total_earned_points: 25,
        current_badge: "Bronze",
      };

      const newUser = new User(newUserBody);
      const savedUser = await newUser.save({ session });

      await PointTransaction.create([{
        userId: savedUser._id,
        points: 25,
        activityType: 'EARN',
        description: `Welcome bonus points`,
      }], { session });

      setImmediate(() => {
        // Send welcome email with plainPassword
        sendUserCreationEmail(email, name, plainPassword, role)
      })

      await session.commitTransaction();
      session.endSession();
      rcResponse.data = savedUser
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    // Return unified response
    rcResponse.message = "User Created Successfully";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res)
  }
}

export const userDetails = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);

    const pipeline: any[] = [
      { $match: { _id: new Types.ObjectId(userId) } },
      { $project: { _id: 1, name: 1, email: 1, profileimage: 1, current_points: 1, total_earned_points: 1, current_badge: 1, address: 1, country: 1, state: 1, city: 1, zipcode: 1, latitude: 1, longitude: 1 } },
    ];

    rcResponse.data = await User.aggregate(pipeline);
    const vouchers = await Voucher.find({ userId }).select("-_id -__v -appliedAt -appliedBy -createdAt -updatedAt -userId");
    rcResponse.data[0].vouchers = vouchers ?? [];

    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const settingResetPassword = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const { newPassword, oldPassword } = req.body;

    const pipeline: any[] = [
      { $match: { _id: new Types.ObjectId(userId) } },
      { $project: { _id: 0, _v: 0 } },
    ];

    const currentUser = (await User.aggregate(pipeline)) as any;

    const isOldPasswordSame = await bcryptjs.compare(
      oldPassword,
      currentUser[0].password
    )

    if (!isOldPasswordSame) {
      return throwError(res, "The current password you entered is incorrect", 400);
    }

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

    // send notification for update password
    setImmediate(() => {
      sendNotification(userId, {
        title: "Password Updated",
        body: `You have successfully updated password`,
        data: {
          type: "profile"
        }
      });
    });

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

    // send notification for update email
    setImmediate(() => {
      sendNotification(user, {
        title: "Email Updated",
        body: `You have successfully updated email`,
        data: {
          type: "profile"
        }
      });
    });

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
    setImmediate(() => {
      sendNotification(userId, {
        title: "Profile Update",
        body: `You have successfully update profile`,
        data: {
          type: "profile"
        }
      });
    });
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("rerro", error);
    return throwError(res);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const { id } = req.params

    // Check if userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return throwError(res, "Invalid user id", HTTP_STATUS_CODE.BAD_REQUEST)
    }

    // Check for any active bookings
    const hasBooking = await TicketBook.exists({ user: id });

    if (hasBooking) {
      return throwError(res, "User has booked tickets so it cannot be deleted.", HTTP_STATUS_CODE.BAD_REQUEST)
    }

    // Proceed to delete
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return throwError(res, "User not found.", HTTP_STATUS_CODE.BAD_REQUEST)
    }

    // Return unified response
    rcResponse.message = "User deleted successfully.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
}
