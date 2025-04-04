import { Request, Response } from "express";
import { ApiResponse, create, findOne, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const sort = { created: -1 };
    const body = req.body;


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
    rcResponse.message = "You are register successfully."
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


    // validation for if email is exists
    const findUser = await findOne("User", { email: body.email }, sort);
    if (!findUser) {
      return throwError(
        res,
        "Email not found",
        HTTP_STATUS_CODE.NOT_FOUND
      );
    };

    // encrypt the password
    const isValidPassword = await bcryptjs.compare(
      body.password,
      findUser.password
    );

    if (!isValidPassword) {
      return throwError(
        res,
        "Invalid Password",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    };

    let tokenUser = {
      _id: findUser._id,
      name: findUser.name,
      email: findUser.email
    };

    const token = jwt.sign(tokenUser, process.env.TOKEN_SECRET!, {
      expiresIn: "1d",
    });

    const userDataWithToken = {
      ...tokenUser,
      token: token
    }
    rcResponse.data = userDataWithToken;
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};
