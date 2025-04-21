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
    let limit;
    if (req.query?.limit) {
      const parsedLimit = parseInt(req.query.limit as string);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    const pipeline: any[] = [
      { $addFields: { likesCount: { $size: { $ifNull: ["$likes", []] } } } },
    ];

    if (limit) {
      pipeline.push({ $limit: limit });
    }

    pipeline.push({ $sort: { likesCount: -1 } });
    pipeline.push({ $project: { title: 1, likesCount: 1, category: 1} });

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
      return throwError(
        res,
        `Invalid ${period} format`,
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Get date range with strict year boundaries
    const { startDate, endDate, groupFormat, currentReference } = getDateRange(
      period,
      reference
    );

    const pipeline: any[] = [
      {
        $match: {
          bookingDate: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$bookingDate" } },
          total: { $sum: "$totalAmount" }, // Changed from avgValue
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rawData = await TicketBook.aggregate(pipeline);

    // Fixed empty interval generation
    const filledData = fillEmptyIntervals(rawData, period, startDate, endDate);

    const response = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: filledData,
      navigation: getNavigation(period, currentReference),
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
    const limit = parseInt(req.query.limit as string) || 10;

    const pipeline: any[] = [
      { $group: { _id: "$user", totalBookings: { $sum: "$seats" } } },
      { $match: { totalBookings: { $gte: 2 } } },
      { $sort: { totalBookings: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          name: "$userDetails.name",
          email: "$userDetails.email",
          totalBookings: 1,
        },
      },
    ];

    rcResponse.data = await TicketBook.aggregate(pipeline);
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    console.log(err);
    return throwError(res);
  }
};

export const bookingsByTicketType = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();

    const pipeline: any[] = [
      {
        $group: {
          _id: "$ticket",
          totalBookings: { $sum: "$seats" }
        }
      },
      {
        $lookup: {
          from: "events",
          let: { ticketId: "$_id" },
          pipeline: [
            { $unwind: "$tickets" },
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$tickets._id" }, 
                    "$$ticketId"
                  ]
                }
              }
            },
            {
              $project: {
                type: "$tickets.type",
                totalSeats: "$tickets.totalSeats",
                totalBooked: "$tickets.totalBookedSeats"
              }
            }
          ],
          as: "ticketInfo"
        }
      },
      { $unwind: "$ticketInfo" },
      {
        $addFields: {
          seatsAvailable: {
            $subtract: ["$ticketInfo.totalSeats", "$ticketInfo.totalBooked"]
          },
          bookingPercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      "$ticketInfo.totalBooked",
                      "$ticketInfo.totalSeats"
                    ]
                  },
                  100
                ]
              },
              2
            ]
          }
        }
      },
      {
        $project: {
          ticketType: "$ticketInfo.type",
          totalBookings: 1,
          totalSeats: "$ticketInfo.totalSeats",
          seatsAvailable: 1,
          bookingPercentage: 1
        }
      },
      { $sort: { totalBookings: -1 } }
    ];

    rcResponse.data = await TicketBook.aggregate(pipeline);
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
