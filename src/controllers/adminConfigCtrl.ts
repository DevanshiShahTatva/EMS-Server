import { Request, Response } from "express";
import { ApiResponse, throwError } from "../helper/common";
import { CancelCharge } from "../models/cancelCharge.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";

export const putCancelCharge = async (req: Request, res: Response) => {
  try {
    const { charge } = req.body;
    const rcResponse = new ApiResponse();

    if (charge < 0) {
      return throwError(
        res,
        "Charge should be zero or more than zero",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    };

    if (charge > 18) {
      return throwError(
        res,
        "Charge should not be more than 18",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    };

    rcResponse.data = await CancelCharge.findOneAndUpdate(
      {},
      { $set: { charge } },
      { new: true, upsert: true }
    ).select("charge");
    rcResponse.message = "Charge has been updated successfully.";

    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const getCancelCharge = async (_req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const existingCharge = await CancelCharge.findOne().select("charge");
    if (!existingCharge) {
      await CancelCharge.create({ charge: 0 });
    }
    rcResponse.data = existingCharge;
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};
