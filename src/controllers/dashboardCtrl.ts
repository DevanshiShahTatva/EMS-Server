import { Request, Response } from "express";
import { ApiResponse, throwError } from "../helper/common";
import Event from "../models/event.modes";
import TicketBook from "../models/eventBooking.model";
import {
  fillEmptyIntervals,
  getDateRange,
  getNavigation,
  PeriodType,
  validatePeriod,
} from "../helper/dateHelper";
import { HTTP_STATUS_CODE } from "../utilits/enum";

export const topLikedEvents = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const limit = parseInt(req.query.limit as string) || 5;
    const pipeline: any[] = [
      { $sort: { likesCounts: -1 } },
      { $limit: limit },
      { $addFields: { likesCount: { $size: { $ifNull: ["$likes", []] } } } },
      { $project: { likes: 0, __v: 0, isLiked: 0 } },
    ];
    const events = await Event.aggregate(pipeline);
    rcResponse.data = events;
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const totalRevenue = async (
  req: Request<{}, {}, {}, { period: PeriodType; reference: string }>,
  res: Response
) => {
  try {
    const rcResponse = new ApiResponse();
    const period = req.query.period || "yearly";
    const reference = req.query.reference;

    // Validate input
    if (validatePeriod(period, reference)) {
      return throwError(res, `Invalid ${period} format`, HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // Get date range with strict year boundaries
    const { startDate, endDate, groupFormat, currentReference } = getDateRange(period, reference);

    const pipeline: any[] = [
      { 
        $match: { 
          bookingDate: { 
            $gte: startDate,
            $lte: endDate
          } 
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$bookingDate" } },
          total: { $sum: "$totalAmount" },  // Changed from avgValue
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const rawData = await TicketBook.aggregate(pipeline);

    // Fixed empty interval generation
    const filledData = fillEmptyIntervals(
      rawData, 
      period, 
      startDate, 
      endDate
    );

    const response = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: filledData,
      navigation: getNavigation(period, currentReference)
    };

    rcResponse.data = response;
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    console.error("Error:", err);
    return throwError(res);
  }
};

export const averageBookingValue = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const topRevenueEvents = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const repeateCustomer = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const bookingsByTicketType = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const bookingsTimeTrends = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const topLocations = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};
