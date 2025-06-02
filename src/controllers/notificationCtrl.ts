import { Request, Response } from "express";
import { ApiResponse, getUserIdFromToken, throwError } from "../helper/common";
import Notification from "../models/notification.model";
import { sendNotification } from "../services/notificationService";
import User from "../models/signup.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";

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

export const markAsAllReadNotification = async (
  req: Request,
  res: Response
) => {
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

export const readNotification = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const notificationId = req.params.id;
    const rcResponse = new ApiResponse();

    rcResponse.data = await Notification.updateOne(
      { userId: userId, _id: notificationId },
      { isRead: true }
    );
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

export const registerFcmToken = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const rcResponse = new ApiResponse();
    const { fcmToken } = req.body;

    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    await User.updateOne(
      { _id: findUser._id },
      { $addToSet: { fcmTokens: fcmToken } } // Prevent duplicates
    );
    rcResponse.message = "Fcm Token has been registered";
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const unregisterFCMToken = async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromToken(req);
    const rcResponse = new ApiResponse();
    const { fcmToken } = req.body;

    const findUser = await User.findOne({ _id: userId });
    if (!findUser) {
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // Remove token from user's devices
    await User.updateOne({ _id: userId }, { $pull: { fcmTokens: fcmToken } });

    rcResponse.message = "Fcm Token has been unregistered";
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};
