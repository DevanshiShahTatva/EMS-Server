import { Request, Response } from "express";
import { ApiResponse, getUserIdFromToken, throwError } from "../helper/common";
import Notification from "../models/notification.model";
import { sendNotification } from "../services/notificationService";

export const getAllNotification = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const rcResponse = new ApiResponse();

    rcResponse.data = await Notification.find({ userId: userId });
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const markAsReadNotification = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const notificationId = req.params.notificationId;
    const rcResponse = new ApiResponse();

    rcResponse.data = await Notification.deleteOne({
      userId: userId,
      _id: notificationId,
    });
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("error::", error);
    return throwError(error);
  }
};

export const markAsAllReadNotification = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const rcResponse = new ApiResponse();

    rcResponse.data = await Notification.deleteMany({ userId: userId });
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("error::", error);
    return throwError(error);
  }
};

export const postNotification = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const rcResponse = new ApiResponse();
    const body = req.body;

    await sendNotification(userId, body);
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};
