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
import { HTTP_STATUS_CODE, MONTH_NAMES } from "../utilits/enum";

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
    pipeline.push({ $project: { title: 1, likesCount: 1, category: 1 } });

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
    return throwError(res);
  }
};

export const totalBookingValue = async (
  req: Request<{}, {}, {}, { period: PeriodType; reference: string }>,
  res: Response
) => {
  try {
    const rcResponse = new ApiResponse();
    const period = req.query.period || "yearly";
    const reference = req.query.reference;

    // Validate period parameters
    if (validatePeriod(period, reference)) {
      return throwError(
        res,
        `Invalid ${period} format`,
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Get date range
    const { startDate, endDate, currentReference } = getDateRange(
      period,
      reference
    );

    // Aggregation pipeline
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
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      { $unwind: "$eventDetails" },
      {
        $group: {
          _id: "$eventDetails.category",
          totalValue: { $sum: "$totalAmount" },
          totalBookings: { $sum: 1 },
        },
      },
      {
        $project: {
          category: "$_id",
          totalValue: 1,
          totalBookings: 1,
          _id: 0,
        },
      },
      { $sort: { totalValue: -1 } },
    ];

    const data = await TicketBook.aggregate(pipeline);

    // Format response
    const response = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: data.map((item) => ({
        category: item.category || "Uncategorized",
        totalValue: item.totalValue,
        bookings: item.totalBookings,
      })),
      navigation: getNavigation(period, currentReference),
    };

    rcResponse.data = response;
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const topRevenueEvents = async (req: Request, res: Response) => {
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
      {
        $group: {
          _id: "$event",
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      { $unwind: "$eventDetails" },
      {
        $project: {
          eventTitle: "$eventDetails.title",
          totalRevenue: 1,
          _id: 0,
        },
      },
    ];

    if (limit) {
      pipeline.push({ $limit: limit });
    }

    rcResponse.data = await TicketBook.aggregate(pipeline);
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

export const bookingsByTicketType = async (_req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();

    const pipeline: any[] = [
      {
        $group: {
          _id: "$ticket",
          totalBookings: { $sum: "$seats" },
        },
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
                  $eq: [{ $toString: "$tickets._id" }, "$$ticketId"],
                },
              },
            },
            {
              $project: {
                type: "$tickets.type",
                totalSeats: "$tickets.totalSeats",
                totalBooked: "$tickets.totalBookedSeats",
              },
            },
          ],
          as: "ticketInfo",
        },
      },
      { $unwind: "$ticketInfo" },
      {
        $addFields: {
          seatsAvailable: {
            $subtract: ["$ticketInfo.totalSeats", "$ticketInfo.totalBooked"],
          },
          bookingPercentage: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [
                      "$ticketInfo.totalBooked",
                      "$ticketInfo.totalSeats",
                    ],
                  },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $project: {
          ticketType: "$ticketInfo.type",
          totalBookings: 1,
          totalSeats: "$ticketInfo.totalSeats",
          seatsAvailable: 1,
          bookingPercentage: 1,
        },
      },
      { $sort: { totalBookings: -1 } },
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
    const year = req.query.year as string;

    // Validate year parameter
    if (!/^\d{4}$/.test(year)) {
      return res.status(400).json({
        success: false,
        message: "Invalid year format. Please use YYYY format.",
      });
    }

    const yearNum = parseInt(year, 10);
    const startDate = new Date(Date.UTC(yearNum, 0, 1)); // January 1st of the year
    const endDate = new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59, 999)); // December 31st

    // Aggregation pipeline
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
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$bookingDate",
                timezone: "UTC",
              },
            },
          },
          bookings: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ];

    // Execute aggregation
    const dailyBookings = await TicketBook.aggregate(pipeline);

    // Create map for quick lookup
    const bookingsMap = new Map(
      dailyBookings.map((item) => [item._id.date, item])
    );

    // Generate complete monthly structure
    const result = [];

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const monthNumber = monthIdx + 1;
      const daysInMonth = new Date(yearNum, monthNumber, 0).getDate();
      const monthData = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const entry = bookingsMap.get(dateStr);

        monthData.push({
          date: dateStr,
          bookings: entry?.bookings || 0,
          revenue: entry?.revenue || 0,
        });
      }

      result.push({
        month: MONTH_NAMES[monthIdx],
        data: monthData,
      });
    }

    rcResponse.data = result;
    rcResponse.message = "Bookings by day retrieved successfully";
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const topLocations = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();

    const pipeline: any[] = [
      {
        $addFields: {
          addressParts: {
            $split: ["$location.address", ", "],
          },
        },
      },
      {
        $addFields: {
          city: {
            $ifNull: [{ $arrayElemAt: ["$addressParts", 0] }, "Unknown City"],
          },
          country: {
            $ifNull: [
              { $arrayElemAt: ["$addressParts", 2] },
              { $arrayElemAt: ["$addressParts", 1] },
              "Unknown Country",
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            city: "$city",
            country: "$country",
          },
          eventCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          location: {
            $cond: [
              { $eq: ["$_id.country", "Unknown Country"] },
              "$_id.city",
              { $concat: ["$_id.city", ", ", "$_id.country"] },
            ],
          },
          eventCount: 1,
        },
      },
      { $sort: { eventCount: -1 } },
    ];

    rcResponse.data = await Event.aggregate(pipeline);
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};
