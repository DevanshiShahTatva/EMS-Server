import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import { appLogger } from "../helper/logger";


export const validateToken = (req: Request, res: Response, next: NextFunction) => {
  const log = appLogger.child({ middleware: 'validateToken' });
  const token = (req.headers?.token as string) || "";

  if (!token) {
    return throwError(res, "Authentication token required", HTTP_STATUS_CODE.UNAUTHORIZED); // 401
  }

  // Verify token
  try {
    const secretKey = process.env.TOKEN_SECRET as string;
    const user = jwt.verify(token, secretKey);

    (req as any).user = user;
    
    next();
  } catch (error) {
    log.error({ err: error }, "Invalid token");
    return throwError(res, "Invalid or expired token", HTTP_STATUS_CODE.UNAUTHORIZED); // 401
  }
};


// 2. Admin-Only Middleware (depends on validateToken)
export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  const log = appLogger.child({ middleware: 'adminOnly' });

  try {
    if (!(req as any).user) {
      return throwError(res, "Authentication required", HTTP_STATUS_CODE.UNAUTHORIZED); // 401
    }

    const user = (req as any).user;
    if (user.role !== 'admin') {
      return throwError(res, "Admin permissions required", HTTP_STATUS_CODE.FORBIDDEN); // 403
    }

    next();

  } catch (error) {
    log.error({ err: error }, "Admin verification failed");
    return throwError(
      res,
      error instanceof Error ? error.message : "Authorization failed",
      HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR // 500
    );
  }
};

// 3. Combined Middleware (validateToken + adminOnly in one step)
export const validateAdminToken = [
  validateToken,
  adminOnly
];
