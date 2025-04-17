import { Request, Response } from "express";
import {
  ApiResponse,
  create,
  findOne,
  throwError,
  updateOne,
} from "../helper/common";
import { COOKIE_OPTIONS, HTTP_STATUS_CODE } from "../utilits/enum";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  resetPasswordSuccessMail,
  sendOtpToEmail,
  sendWelcomeEmail,
} from "../helper/nodemailer";

dotenv.config();

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
      return res
        .cookie("token", token, COOKIE_OPTIONS)
        .status(rcResponse.status)
        .send(rcResponse);
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
      return res
        .cookie("token", token, COOKIE_OPTIONS)
        .status(rcResponse.status)
        .send(rcResponse);
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
