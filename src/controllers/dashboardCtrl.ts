import { Request, Response } from "express";
import { ApiResponse, throwError, getUserIdFromToken } from "../helper/common";
import Event from "../models/event.model";
import TicketBook from "../models/eventBooking.model";
import {
  fillEmptyIntervals,
  getDateRange,
  getNavigation,
  PeriodType,
  validatePeriod,
} from "../helper/dateHelper";
import { HTTP_STATUS_CODE, MONTH_NAMES } from "../utilits/enum";
import User from "../models/signup.model";
import mongoose from "mongoose";
import Feedback from "../models/feedback.model";

export const dashboardOverview = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    // Execute all queries in parallel
    const [totalUsers, totalRevenueResult, totalEvents, totalLocationsResult] =
      await Promise.all([
        // Total Users
        User.countDocuments({ role: "user" }),

        // Total Revenue
        TicketBook.aggregate([
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),

        // Total Events
        Event.countDocuments(),

        // Unique Locations (group by lat/lng)
        Event.aggregate([
          { $group: { _id: { lat: "$location.lat", lng: "$location.lng" } } },
          { $count: "totalLocations" },
        ]),
      ]);

    // Extract values from aggregation results
    const totalRevenue = totalRevenueResult[0]?.total || 0;
    const totalLocations = totalLocationsResult[0]?.totalLocations || 0;

    rcResponse.data = {
      totalUsers,
      totalRevenue,
      totalEvents,
      totalLocations,
    };
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    return throwError(res);
  }
};

export const topLikedEvents = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    let limit: number | undefined; // No default limit

    // Parse limit only if provided in the query
    if (req.query?.limit) {
      const parsedLimit = parseInt(req.query.limit as string);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    let pipeline: any[] = [
      // Calculate likesCount for all events
      { $addFields: { likesCount: { $size: { $ifNull: ["$likes", []] } } } },
    ];

    // Conditional logic based on limit
    if (limit) {
      // When limit is provided: filter, sort, and limit
      pipeline.push(
        { $match: { likesCount: { $gt: 0 } } }, // Exclude 0 likes
        { $sort: { likesCount: -1 } },
        { $limit: limit }
      );
    } else {
      // When no limit: sort all events (including 0 likes)
      pipeline.push({ $sort: { likesCount: -1 } });
    }

    // Common stages for both cases
    pipeline.push(
      // Include necessary fields
      { $project: { title: 1, likesCount: 1, category: 1 } },
      // Populate category
      {
        $lookup: {
          from: "ticketcategories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      // Convert category array to object
      { $unwind: "$category" }
    );

    const events = await Event.aggregate(pipeline);
    rcResponse.data = events;
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    console.log("error::", err);
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
    if (period !== "overall" && validatePeriod(period, reference)) {
      return throwError(
        res,
        `Invalid ${period} format`,
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Get date range - modified for "overall" case
    let startDate, endDate, groupFormat, currentReference;

    if (period === "overall") {
      // For overall, we'll get all available years
      startDate = new Date(0); // Very old date
      endDate = new Date(); // Current date
      groupFormat = "%Y"; // Group by year only
      currentReference = "overall";
    } else {
      ({ startDate, endDate, groupFormat, currentReference } = getDateRange(
        period,
        reference
      ));
    }

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
          total: { $sum: "$totalAmount" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const rawData = await TicketBook.aggregate(pipeline);

    // For overall, we don't need to fill empty intervals between years
    const filledData =
      period === "overall"
        ? rawData
        : fillEmptyIntervals(rawData, period, startDate, endDate);

    const response = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: filledData,
      navigation:
        period === "overall" ? null : getNavigation(period, currentReference),
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

    // Validate period parameters (skip validation for 'overall')
    if (period !== "overall" && validatePeriod(period, reference)) {
      return throwError(
        res,
        `Invalid ${period} format`,
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Get date range - modified for 'overall' case
    let startDate, endDate, currentReference;

    if (period === "overall") {
      startDate = new Date(0); // Unix epoch
      endDate = new Date(); // Current date
      currentReference = "overall";
    } else {
      ({ startDate, endDate, currentReference } = getDateRange(
        period,
        reference
      ));
    }

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
        $lookup: {
          from: "ticketcategories", // Match your collection name exactly
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          category: {
            $cond: [
              { $ifNull: ["$categoryDetails.name", false] },
              "$categoryDetails.name",
              "Uncategorized"
            ]
          },
          categoryId: { $toString: "$_id" },
          totalValue: 1,
          totalBookings: 1,
          _id: 0,
        },
      },
      { $sort: { totalValue: -1 } },
    ];

    const data = await TicketBook.aggregate(pipeline);

    const response = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data: data.map((item) => ({
        category: item.category,
        // categoryId: item.categoryId,
        totalValue: item.totalValue,
        bookings: item.totalBookings,
      })),
      navigation: period === "overall" ? null : getNavigation(period, currentReference),
    };

    rcResponse.data = response;
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    console.error("Error in totalBookingValue:", err);
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
      // First get all ticket bookings grouped by ticket ID
      {
        $group: {
          _id: "$ticket",
          totalBookings: { $sum: "$seats" }
        }
      },
      // Lookup ticket details from events
      {
        $lookup: {
          from: "events",
          let: { ticketId: "$_id" },
          pipeline: [
            { $unwind: "$tickets" },
            {
              $match: {
                $expr: {
                  $eq: ["$tickets._id", { $toObjectId: "$$ticketId" }]
                }
              }
            },
            {
              $project: {
                ticketTypeId: "$tickets.type",  // Ensure we're using the correct field
                totalSeats: "$tickets.totalSeats",
                totalBooked: "$tickets.totalBookedSeats"
              }
            }
          ],
          as: "ticketInfo"
        }
      },
      { $unwind: "$ticketInfo" },
      // Lookup ticket type name
      {
        $lookup: {
          from: "tickettypes",
          localField: "ticketInfo.ticketTypeId",
          foreignField: "_id",
          as: "typeDetails"
        }
      },
      { $unwind: { path: "$typeDetails", preserveNullAndEmptyArrays: true } },
      // Now group by ticket type name to consolidate
      {
        $group: {
          _id: "$typeDetails.name",
          totalBookings: { $sum: "$totalBookings" },
          totalSeats: { $sum: "$ticketInfo.totalSeats" },
          totalBooked: { $sum: "$ticketInfo.totalBooked" },
          // Calculate available seats from the summed values
          seatsAvailable: {
            $sum: {
              $subtract: ["$ticketInfo.totalSeats", "$ticketInfo.totalBooked"]
            }
          }
        }
      },
      // Calculate percentage after consolidation
      {
        $addFields: {
          bookingPercentage: {
            $cond: [
              { $eq: ["$totalSeats", 0] },
              0,
              {
                $round: [
                  { $multiply: [{ $divide: ["$totalBooked", "$totalSeats"] }, 100] },
                  2
                ]
              }
            ]
          }
        }
      },
      // Final projection
      {
        $project: {
          ticketType: "$_id",
          totalBookings: 1,
          totalSeats: 1,
          seatsAvailable: 1,
          bookingPercentage: 1,
          _id: 0
        }
      },
      { $sort: { totalBookings: -1 } }
    ];

    rcResponse.data = await TicketBook.aggregate(pipeline);
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    console.error("Error in bookingsByTicketType:", err);
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

export const getCancellationRate = async (req: Request, res: Response) => {
  try {
    const { eventId, limit } = req.query;

    const rcResponse = new ApiResponse();

    // Define the aggregation pipeline
    const pipeline: any[] = [
      {
        // Group by {event, user} and calculate if the user has any active bookings
        $group: {
          _id: { event: "$event", user: "$user" },
          hasActive: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$bookingStatus", "booked"] },
                    { $eq: ["$cancelledAt", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        // Project fields to determine if the user has no active bookings
        $project: {
          event: "$_id.event",
          isCancelled: { $eq: ["$hasActive", 0] },
        },
      },
      {
        // Group by event and calculate totals
        $group: {
          _id: "$event",
          totalBookedUsers: { $sum: 1 },
          cancelledUsers: {
            $sum: {
              $cond: ["$isCancelled", 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "_id",
          as: "event"
        }
      },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          eventId: "$_id",
          event: {
            title: "$event.title",
            startDate: "$event.startDateTime",
            category: "$event.category",
            location: "$event.location.address"
          },
          totalBookedUsers: 1,
          cancelledUsers: 1,
          cancellationRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$cancelledUsers", "$totalBookedUsers"] },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { cancellationRate: -1 } },
    ];

    if (limit) {
      pipeline.push(
        { $match: { cancelledUsers: { $gt: 0 } } },
        { $limit: parseInt(limit as string) }
      );
    };

    // Run the aggregation
    const allData = await TicketBook.aggregate(pipeline);

    // Handle single event case
    if (eventId) {
      // Remove limit/sort for single event lookup
      const fullPipeline = pipeline.slice(0, -2); // Remove sort and limit
      const eventData = await TicketBook.aggregate([
        ...fullPipeline,
        { $match: { event: new mongoose.Types.ObjectId(eventId as string) } },
      ]);

      rcResponse.data = eventData[0] || {
        event: eventId,
        totalBookedUsers: 0,
        cancelledUsers: 0,
        cancellationRate: 0.0,
      };
    } else {
      rcResponse.data = allData;
    }

    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const topAttendedEvents = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    let parsedLimit: number | undefined = undefined;

    if (limit) {
      const asNumber = parseInt(limit as string);
      if (!isNaN(asNumber) && asNumber > 0) {
        parsedLimit = asNumber;
      }
    }

    const pipeline: any[] = [
      {
        $group: {
          _id: "$event",
          totalAttendees: {
            $sum: {
              $cond: [{ $eq: ["$isAttended", true] }, 1, 0],
            },
          },
          totalBookedSeats: { $sum: "$seats" },
        },
      },
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
        $addFields: {
          attendanceRatioValue: {
            $cond: [
              { $eq: ["$totalBookedSeats", 0] },
              0,
              { $multiply: [{ $divide: ["$totalAttendees", "$totalBookedSeats"] }, 100] },
            ],
          },
        },
      },
      {
        $sort: {
          attendanceRatioValue: -1,     // Sort by percentage first
          totalBookedSeats: -1          // Then by booked seats
        },
      },
      {
        $addFields: {
          attendanceRatio: {
            $concat: [
              { $toString: { $round: ["$attendanceRatioValue", 2] } },
              "%"
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          eventId: "$eventDetails._id",
          eventTitle: "$eventDetails.title",
          totalAttendees: 1,
          totalBookedSeats: 1,
          attendanceRatio: 1
        }
      }
    ];

    if (parsedLimit) {
      pipeline.push({ $limit: parsedLimit });
    }

    const stats = await TicketBook.aggregate(pipeline);
    const rcResponse = new ApiResponse(stats);

    res.status(200).json(rcResponse);
  } catch (err) {
    return throwError(res);
  }
}

export const userBadgeInfo = async (req: Request, res: Response) => {
  try {
    const badgeTypes = ['Bronze', 'Silver', 'Gold'];
    const counts = await User.aggregate([
      {
        $group: {
          _id: "$current_badge",
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = counts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const finalResult = badgeTypes.map(badge => ({
      badge,
      count: countMap[badge] ?? 0
    }));

    const rcResponse = new ApiResponse();
    rcResponse.data = finalResult;
    res.status(200).json(rcResponse);
  } catch (err) {
    return throwError(err);
  }
}

export const getEventFeedbackAnalytics = async (
  req: Request<{}, {}, {}, { period: PeriodType; reference: string }>,
  res: Response
) => {
  try {
    const rcResponse = new ApiResponse();
    const period = req.query.period || "yearly";
    const reference = req.query.reference;

    let startDate, endDate, currentReference;

    if (period === "overall") {
      startDate = new Date(0);
      endDate = new Date();
      currentReference = "overall";
    } else {
      ({ startDate, endDate, currentReference } = getDateRange(period, reference));
    }

    const pipeline: any[] = [
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      // Join with the Events collection to get event details
      {
        $lookup: {
          from: "events",
          localField: "eventId",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      {
        $unwind: {
          path: "$eventDetails",
          preserveNullAndEmptyArrays: true
        },
      },
      {
        $group: {
          _id: "$eventId",
          totalFeedbacks: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          ratingsCount: {
            $push: "$rating",
          },
          eventTitle: { $first: "$eventDetails.title" },
          eventImage: { $first: "$eventDetails.image" },
        },
      },
      {
        $addFields: {
          ratingsBreakdown: {
            $arrayToObject: {
              $map: {
                input: [1, 2, 3, 4, 5],
                as: "star",
                in: {
                  k: { $toString: "$$star" },
                  v: {
                    $size: {
                      $filter: {
                        input: "$ratingsCount",
                        as: "rating",
                        cond: { $eq: ["$$rating", "$$star"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          eventId: "$_id",
          eventTitle: 1,
          eventImage: 1,
          averageRating: { $round: ["$averageRating", 1] },
          totalFeedbacks: 1,
          ratingsBreakdown: 1,
        },
      },
    ];

    const data = await Feedback.aggregate(pipeline);

    rcResponse.data = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      data,
    };
    return res.status(200).send(rcResponse);
  } catch (err) {
    console.error("Error in getEventFeedbackAnalytics:", err);
    return throwError(res);
  }
};

export const getEventFeedbackDistribution = async (
  req: Request<{ eventId: string }, {}, {}, { period?: PeriodType; reference?: string }>,
  res: Response
) => {
  try {
    const rcResponse = new ApiResponse();
    const { eventId } = req.params;
    const period = req.query.period || "overall";
    const reference = req.query.reference;

    let startDate: Date, endDate: Date, currentReference: string;

    if (period === "overall") {
      startDate = new Date(0);
      endDate = new Date();
      currentReference = "overall";
    } else {
      ({ startDate, endDate, currentReference } = getDateRange(period, reference!));
    }

    const distribution = await Feedback.aggregate([
      {
        $match: {
          eventId: new mongoose.Types.ObjectId(eventId),
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const fullDistribution = [1, 2, 3, 4, 5].map((star) => ({
      rating: star,
      count: distribution.find((d) => d._id === star)?.count || 0,
    }));

    rcResponse.data = {
      eventId,
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ratings: fullDistribution,
    };

    res.status(200).json(rcResponse);
  } catch (error) {
    console.error("Error in getEventFeedbackDistribution:", error);
    return throwError(res);
  }
};


export const getFeedbackOverviewRatings = async (
  req: Request<{}, {}, {}, { period?: PeriodType; reference?: string }>,
  res: Response
) => {
  try {
    const rcResponse = new ApiResponse();
    const period = req.query.period || 'yearly';
    const reference = req.query.reference;

    const { startDate, endDate, groupFormat, currentReference } = getDateRange(period, reference!);

    const previousReference =
      period === 'yearly'
        ? (parseInt(currentReference) - 1).toString()
        : (() => {
          const [y, m] = currentReference.split('-').map(Number);
          const prevDate = new Date(y, m - 2);
          return `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
        })();

    const { startDate: prevStart, endDate: prevEnd } = getDateRange(period, previousReference);

    const currentPeriodData = await Feedback.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: '$createdAt' },
          },
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const currentTotal = currentPeriodData.reduce((sum, d) => sum + d.count, 0);
    const currentAvgRating =
      currentPeriodData.length > 0
        ? currentPeriodData.reduce((sum, d) => sum + d.averageRating * d.count, 0) / currentTotal
        : 0;

    const previousTotalData = await Feedback.aggregate([
      {
        $match: {
          createdAt: {
            $gte: prevStart,
            $lte: prevEnd,
          },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    const previousTotal = previousTotalData?.[0]?.count || 0;
    const growth =
      previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100;

    rcResponse.data = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalFeedbacks: currentTotal,
      averageRating: parseFloat(currentAvgRating.toFixed(2)),
      feedbackGrowthRate: growth !== null ? parseFloat(growth.toFixed(2)) : null,
      breakdown: currentPeriodData.map((entry) => ({
        period: entry._id,
        feedbacks: entry.count,
        averageRating: parseFloat(entry.averageRating.toFixed(2)),
      })),
    };

    return res.status(200).json(rcResponse);
  } catch (error) {
    console.error('Error in getFeedbackOverviewRatings:', error);
    return throwError(res);
  }
};

export const getEventOverviewFeedback = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();

    const events = await Event.find({}, { _id: 1, title: 1 });

    const eventIds = events.map(event => event._id);

    const feedbackStats = await Feedback.aggregate([
      {
        $match: {
          eventId: { $in: eventIds }
        }
      },
      {
        $group: {
          _id: '$eventId',
          totalFeedbacks: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const statsMap = feedbackStats.reduce((acc, curr) => {
      acc[curr._id.toString()] = {
        totalFeedbacks: curr.totalFeedbacks,
        averageRating: parseFloat(curr.averageRating.toFixed(2))
      };
      return acc;
    }, {} as Record<string, { totalFeedbacks: number; averageRating: number }>);

    const result = events.map(event => ({
      eventId: event._id,
      title: event.title,
      totalFeedbacks: statsMap[event._id.toString()]?.totalFeedbacks || 0,
      averageRating: statsMap[event._id.toString()]?.averageRating || 0
    }));
    result.sort((a, b) => b.averageRating - a.averageRating);
    rcResponse.data = result;
    return res.status(200).json(rcResponse);
  } catch (error) {
    console.error('Error in getEventOverviewFeedback:', error);
    return throwError(res);
  }
};

export const getOverallFeedbackDistribution = async (
  req: Request<{}, {}, {}, { period?: PeriodType; reference?: string }>,
  res: Response
) => {
  try {
    const rcResponse = new ApiResponse();
    const period = req.query.period || 'overall';
    const reference = req.query.reference;

    let startDate: Date, endDate: Date, currentReference: string;

    if (period === 'overall') {
      startDate = new Date(0);
      endDate = new Date();
      currentReference = 'overall';
    } else {
      ({ startDate, endDate, currentReference } = getDateRange(period, reference!));
    }

    const distribution = await Feedback.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const fullDistribution = [1, 2, 3, 4, 5].map((star) => ({
      rating: star,
      count: distribution.find((d) => d._id === star)?.count || 0,
    }));

    rcResponse.data = {
      period,
      currentReference,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ratings: fullDistribution,
    };

    return res.status(200).json(rcResponse);
  } catch (error) {
    console.error('Error in getOverallFeedbackDistribution:', error);
    return throwError(res);
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const users = await User.find(
      {
        _id: { $ne: userId },
        role: { $nin: ["admin", "organizer"] }
      },
      { name: 1, 'profileimage.url': 1 }
    );
    rcResponse.data = users;
    res.status(rcResponse.status).send(rcResponse);
  } catch (err) {
    console.log("Err:" + err);
    return throwError(res);
  }
}