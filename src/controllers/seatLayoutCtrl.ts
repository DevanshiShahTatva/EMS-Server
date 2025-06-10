import { Response, Request } from "express";
import { ApiResponse, throwError } from "../helper/common";
import Event from "../models/event.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import { SeatLayout } from "../models/seatLayout.model";
import { populateSeatLayoutStages } from "../helper/populates/populateSeatLayoutStages";
import { Types } from "mongoose";

export const createSeatLayout = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const { seatLayout, eventId } = req.body;

    const findEvent = await Event.findOne({ _id: eventId });
    if (!findEvent) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    rcResponse.data = await SeatLayout.create({ event: eventId, seatLayout });
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const updateSeatLayout = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const { seatLayout, eventId } = req.body;

    const findEvent = await Event.findOne({ _id: eventId });
    if (!findEvent) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    rcResponse.data = await SeatLayout.findOneAndUpdate({ event: eventId }, { seatLayout });
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("Error::", error)
    return throwError(res);
  }
};

export const getSeatLayout = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const eventId = req.params.id;

    const findEvent = await Event.findOne({ _id: eventId });
    if (!findEvent) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    const pipeline = [
      { $match: { event: new Types.ObjectId(eventId) } },
      ...populateSeatLayoutStages(),
    ];

    rcResponse.data = await SeatLayout.aggregate(pipeline);
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};
