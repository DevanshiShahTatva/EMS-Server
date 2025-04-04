import { Request, NextFunction } from "express";
import { ApiResponse, find, throwError } from "../helper/common";

export const postEvent = (req: Request, res: any, next: NextFunction) => {
  try {
    const rcResponse = new ApiResponse();
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    next(err);
  }
};

export const getEvents = async (req: Request, res: any, next: NextFunction) => {
  try {
    const rcResponse = new ApiResponse();
    let sort = { created: -1 };
    // rcResponse.data = await find("Events", { id: 1 }, sort, 1, 10);
    if(true) {
      return throwError(res, "data not dounf", 404)
    }
    rcResponse.data = [{ id: 21 }]
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    // next(error);
  }
};
