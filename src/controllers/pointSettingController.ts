import { Request, Response } from 'express';
import PointSettings from "../models/pointSetting.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import { getUserIdFromToken, throwError } from "../helper/common";
import PointTransaction from '../models/pointTransaction';

export const getPointSettings = async (req: Request, res: Response) => {
  try {
    let settings = await PointSettings.findOne().sort({ updatedAt: -1 });
    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      conversionRate: settings?.conversionRate ?? null
    });
  } catch (error) {
    return throwError(error, 'Failed to retrieve conversion rate', HTTP_STATUS_CODE.BAD_REQUEST);
  }
};

export const updatePointSettings = async (req: Request, res: Response) => {
  const { conversionRate } = req.body;

  try {
    const settings = await PointSettings.findOne();
    if (!settings) {
      return res.status(400).json({ message: 'Point settings not found!' });
    }
    settings.conversionRate = conversionRate;
    await settings.save();
    res.json({ success: true, message: "Conversion rate updated", data: settings.conversionRate });
  } catch (error) {
    return throwError(error, 'Failed to update conversion rate', HTTP_STATUS_CODE.BAD_REQUEST);
  }
};

export const getPointHistory = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    const transactions = await PointTransaction.find({ userId })
      .select('activityType description points createdAt')
      .sort({ createdAt: -1 });

    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    return throwError(error, 'Failed to retrieve transactions', HTTP_STATUS_CODE.BAD_REQUEST);
  }
};