import { Request, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { throwError } from "../helper/common";

export const validateToken = (
  req: Request,
  res: any,
  next: NextFunction
) => {
  const token = (req.headers?.token as string) || "";

  // check if token is present
  if (!token) {
    return throwError(res, "Invalid Token", 400);
  }

  // verify token
  try {
    const secretKey = process.env.TOKEN_SECRET as string;
    const user = jwt.verify(token, secretKey);

    (req as any).user = user;
    next();
  } catch (error) {
    return throwError(res, "Unauthorized", 401);
  }
};
