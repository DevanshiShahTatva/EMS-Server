import { Request, Response } from "express";
import { ApiResponse, create, findOne, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import bcryptjs from "bcryptjs";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const sort = { created: -1 };
    const body = req.body;


    // validation for if email is exists
    const isEmailTaken = await findOne("Signup", { email: body.email }, sort);
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

    rcResponse.data = await create("Signup", newBody);
    rcResponse.message = "You are register successfully."
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};
