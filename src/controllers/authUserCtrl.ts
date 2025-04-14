import { Request, Response } from "express";
import { ApiResponse, create, findOne, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { sendWelcomeEmail } from "../helper/nodemailer";

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
      rcResponse.message = "You have login successfully."
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
      rcResponse.message = "You have login successfully."
      return res.status(rcResponse.status).send(rcResponse);
    }
  } catch (err) {
    return throwError(res);
  }
};
