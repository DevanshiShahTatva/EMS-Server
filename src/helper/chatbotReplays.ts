import { Request } from "express";
import { Types } from "mongoose";
import Event from "../models/event.model";
import Feedback from "../models/feedback.model";
import User from "../models/signup.model";
import { getUserIdFromToken } from "./common";

interface Intent {
  name: string;
  confidence?: number;
}

interface Entity {
  [key: string]: { value: string; role?: string }[];
}

interface TicketType {
  name: string;
  description: string;
}

interface Ticket {
  type: TicketType;
  price: number;
}

interface EventType {
  _id: string;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  duration: string;
  location: {
    address: string;
  };
  tickets: Ticket[];
  category: {
    _id: string;
    name: string;
  };
  distance: number;
}

interface NLPData {
  intents?: Intent[];
  entities?: Entity;
}

export const RECORDS_PER_PAGE = 5;

export const getAnswerForIntent = async (
  data: NLPData,
  req: Request
): Promise<string> => {
  const intent = data.intents?.[0]?.name;
  const entities = data.entities || {};

  console.log("intent::", intent);
  console.log("entities::", entities);

  switch (intent) {
    case "faq_attend_no_account":
      return "No, creating an account is mandatory to book and attend events. This allows us to manage your bookings securely, send you event updates, and provide a personalized experience. It also ensures that you can easily access, manage, or transfer your tickets if needed.";

    case "faq_cancel_event":
      return "To cancel an event, please go to the my bookings page and click the \"Cancel Event\" button. You'll then be prompted to confirm your decision. You'll also be refunded with the amount you paid minus the platform fees.";

    case "faq_book_ticket":
      return 'You can book your tickets directly on our event page by clicking the "Get Tickets" button and following the prompts, or through our authorized ticketing partners.';

    case "faq_online_payment":
      return "Absolutely. We partner with trusted payment providers like Stripe and Razorpay. All transactions are protected using advanced SSL encryption. Your payment information is never stored on our servers, ensuring maximum privacy and security.";

    case "event_details":
      return await getEventDetailAnswer(entities);

    case "get_events_by_category":
      return await getEventsByCategoryAnswer(entities);

    case "get_events_by_rating":
      return await getEventsByRatingAnswer(entities);

    case "get_most_liked_events":
      return await getMostLikedEventsAnswer();

    case "get_similar_events":
      return await getSimilarEventsAnswer(entities);

    case "get_events_by_location":
      return await getEventsByLocationAnswer(entities, req);

    default:
      return "Sorry, I couldn't find an answer to your question. Could you please rephrase or ask another question?";
  }
};

export const getEventDetailAnswer = async (
  entities: Entity
): Promise<string> => {
  let dbEvent: EventType[] = [];

  if (entities["event_name:event_name"]?.[0]?.value) {
    dbEvent = await Event.find({
      title: {
        $regex: entities["event_name:event_name"]?.[0]?.value,
        $options: "i",
      },
    }).populate("tickets.type");
  }

  if (dbEvent.length > 0) {
    const event = dbEvent[0];

    const detail_type = ["date", "duration", "location", "price", "review"];

    const request_details_type = detail_type
      .map((type) => entities[`detail_type:${type}`]?.[0]?.role)
      .filter((type) => type !== undefined);

    if (request_details_type.length) {
      const requestEventDetailsAnswer = await Promise.all(
        request_details_type.map(
          async (type) => await getDBEventDetailAnswer(event, type)
        )
      );

      return requestEventDetailsAnswer.join("</br> </br>");
    } else {
      return `Here are the details of the event <b>${event.title}</b>:\n${event.description}`;
    }
  } else {
    if (entities["event_name:event_name"]?.[0]?.value) {
      return `Sorry, I couldn't find any event with this name <b>${entities["event_name:event_name"]?.[0]?.value}</b>. Please check the spelling or try a different event name.`;
    } else {
      return "Sorry, I couldn't find any event with the provided details. Please give me a proper event name.";
    }
  }
};

export const getDBEventDetailAnswer = async (
  event: EventType,
  detailType: string | undefined
): Promise<string> => {
  switch (detailType) {
    case "date":
      return `The event starts on <b>${new Date(event.startDateTime).toLocaleString()}</b> and ends on <b>${new Date(event.endDateTime).toLocaleString()}</b>.`;

    case "duration":
      return `The event lasts for <b>${event.duration}</b>.`;

    case "location":
      return `The event will be held at <b>${event.location.address}</b>.`;

    case "price":
      const ticket = event.tickets.map(
        (ticket) =>
          `The <b>${ticket.type.name}</b> ticket costs <b>₹${ticket.price}</b>. ${!!ticket.type.description ? "It includes: " + ticket.type.description + "." : ""}`
      );
      return ticket.join("</br>");

    case "review":
      return await getEventFeedback(event._id);

    default:
      return `Here are the details of the event <b>${event.title}</b>:\n${event.description}`;
  }
};

export const getEventFeedback = async (eventId: string) => {
  const feedbackResult = await Feedback.find({
    eventId,
  })
    .populate({
      path: "userId",
      select: "name email profileimage",
    })
    .sort({ createdAt: -1 })
    .limit(RECORDS_PER_PAGE);

  const totalFeedbackAndAverageRating = await Feedback.aggregate([
    { $match: { eventId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalFeedback: { $sum: 1 },
      },
    },
  ]);

  const feedbackAnswer = feedbackResult.map(
    (fb) => `
        <b>User:</b> ${fb.userId ? fb.userId.name : "Anonymous User"} </br>
        <b>Email:</b> ${fb.userId ? fb.userId.email : "Anonymous User"} </br>
        <b>Rating:</b> ${fb.rating} </br>
        <b>Description:</b> ${fb.description} </br>
        <b>Created At:</b> ${fb.createdAt}`
  );

  const feedbackWithAverageRating =
    `<b>Total Feedbacks:</b> ${totalFeedbackAndAverageRating[0]?.totalFeedback || 0}` +
    "</br>" +
    `<b>Average Rating:</b> ${totalFeedbackAndAverageRating[0]?.averageRating || 0}` +
    "</br> </br>" +
    feedbackAnswer.join("</br> </br>");

  return feedbackWithAverageRating;
};

export const getEventsByCategoryAnswer = async (entities: Entity) => {
  const category =
    entities["event_category:event_category"]?.[0]?.value.toLowerCase();

  let dbEvents: EventType[] = [];

  if (category) {
    dbEvents = await Event.aggregate([
      {
        $lookup: {
          from: "ticketcategories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $match: {
          "category.name": {
            $regex: category,
            $options: "i",
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $limit: RECORDS_PER_PAGE,
      },
    ]);

    if (dbEvents.length) {
      const eventDetails = dbEvents.map(
        (event) =>
          `<b>${event.title}</b> </br> <b>Location:</b> ${event.location.address} </br> <b>Start Date:</b> ${new Date(
            event.startDateTime
          ).toLocaleString()} </br> <b>End Date:</b> ${new Date(
            event.endDateTime
          ).toLocaleString()} </br> <b>Category:</b> ${event.category.name}`
      );

      return eventDetails.join("</br> </br>");
    } else {
      return "Sorry, I couldn't find any event with the provided details. Please give me a proper event category.";
    }
  } else {
    return "Sorry, I couldn't find any event with the provided details. Please give me a proper event category.";
  }
};

export const getEventsByRatingAnswer = async (entities: Entity) => {
  const number = Number(entities["wit$number:number"]?.[0]?.value || 5);

  const dbEvents = await Feedback.aggregate([
    {
      $group: {
        _id: "$eventId",
        averageRating: { $avg: "$rating" },
        totalRatings: { $sum: 1 },
      },
    },
    {
      $match: {
        averageRating: { $gte: number },
      },
    },
    {
      $lookup: {
        from: "events",
        localField: "_id",
        foreignField: "_id",
        as: "event",
      },
    },
    {
      $unwind: "$event",
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$event",
            { averageRating: "$averageRating", totalRatings: "$totalRatings" },
          ],
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $limit: RECORDS_PER_PAGE,
    },
  ]);

  if (dbEvents.length) {
    const eventDetails = dbEvents.map(
      (event) =>
        `<b>${event.title}</b> </br> <b>Location:</b> ${event.location.address} </br> <b>Start Date:</b> ${new Date(
          event.startDateTime
        ).toLocaleString()} </br> <b>End Date:</b> ${new Date(
          event.endDateTime
        ).toLocaleString()} </br> <b>Average Rating:</b> ${event.averageRating} </br> <b>Total Ratings:</b> ${event.totalRatings}`
    );

    return eventDetails.join("</br> </br>");
  } else {
    return "Sorry, I couldn't find any event with the provided rating.";
  }
};

export const getMostLikedEventsAnswer = async () => {
  const dbEvents = await Event.aggregate([
    {
      $addFields: {
        likesCount: { $size: { $ifNull: ["$likes", []] } },
      },
    },
    {
      $sort: { likesCount: -1 },
    },
    {
      $limit: RECORDS_PER_PAGE,
    },
  ]);

  const mostLikedEvents = dbEvents.map(
    (event) => `
        <b>${event.title}</b> </br> <b>Location:</b> ${event.location.address} </br> <b>Start Date:</b> ${new Date(
          event.startDateTime
        ).toLocaleString()} </br> <b>End Date:</b> ${new Date(
          event.endDateTime
        ).toLocaleString()} </br>
        <b>Likes:</b> ${event.likesCount}`
  );

  return mostLikedEvents.join("</br> </br>");
};

export const getSimilarEventsAnswer = async (entities: Entity) => {
  let dbEvents: EventType[] = [];

  if (entities["event_name:event_name"]?.[0]?.value) {
    dbEvents = await Event.find({
      title: {
        $regex: entities["event_name:event_name"]?.[0]?.value,
        $options: "i",
      },
    }).populate("category");

    if (dbEvents.length > 0) {
      const categoryId = dbEvents[0].category._id;

      const dbSimilarEvents = await Event.aggregate([
        {
          $lookup: {
            from: "ticketcategories",
            localField: "category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $match: {
            "category._id": categoryId,
            _id: { $ne: dbEvents[0]._id },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: RECORDS_PER_PAGE,
        },
      ]);

      if (dbSimilarEvents.length) {
        const eventDetails = dbSimilarEvents.map(
          (event) =>
            `<b>${event.title}</b> </br> <b>Location:</b> ${event.location.address} </br> <b>Start Date:</b> ${new Date(
              event.startDateTime
            ).toLocaleString()} </br> <b>End Date:</b> ${new Date(
              event.endDateTime
            ).toLocaleString()} </br> <b>Category:</b> ${event.category.name}`
        );
        return eventDetails.join("</br> </br>");
      } else {
        return "Sorry, I couldn't find any similar event with the provided details. Please give me a other event name.";
      }
    } else {
      return "Sorry, I couldn't find any event with the provided details. Please give me a proper event name.";
    }
  } else {
    return "Sorry, I couldn't find any event with the provided details. Please give me a proper event name.";
  }
};

export const getEventsByLocationAnswer = async (
  entities: Entity,
  req: Request
) => {
  const location = entities["detail_type:location"]?.[0]?.value;

  let dbEvents: EventType[] = [];

  if (location) {
    dbEvents = await Event.find({
      "location.address": {
        $regex: location,
        $options: "i",
      },
    })
      .sort({ createdAt: -1 })
      .limit(RECORDS_PER_PAGE);
  } else {
    try {
      const userId = getUserIdFromToken(req);

      if (userId) {
        const pipeline: any[] = [
          { $match: { _id: new Types.ObjectId(userId) } },
          {
            $project: {
              _id: 1,
              latitude: 1,
              longitude: 1,
            },
          },
        ];

        const userData: { latitude: string; longitude: string }[] =
          await User.aggregate(pipeline);

        if (userData.length && userData[0].latitude && userData[0].longitude) {
          const distanceField = entities["wit$distance:distance"]?.[0]?.value;

          const distance = Number(distanceField)
            ? Number(distanceField) * 1000
            : 25000;

          dbEvents = await Event.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [
                    parseFloat(userData[0].longitude),
                    parseFloat(userData[0].latitude),
                  ],
                },
                distanceField: "distance",
                spherical: true,
                maxDistance: distance, // in meters
              },
            },
            {
              $sort: { distance: 1 },
            },
            {
              $limit: RECORDS_PER_PAGE,
            },
          ]);
        } else {
          return "Sorry, you need to add your profile address to get events by location.";
        }
      } else {
        return "Sorry, you must be logged in to get events by location.";
      }
    } catch (error) {
      return "Sorry, you must be logged in to get events by location.";
    }
  }

  if (dbEvents.length) {
    const eventDetails = dbEvents.map(
      (event) =>
        `<b>${event.title}</b> </br> <b>Location:</b> ${event.location.address} </br> <b>Start Date:</b> ${new Date(
          event.startDateTime
        ).toLocaleString()} </br> <b>End Date:</b> ${new Date(
          event.endDateTime
        ).toLocaleString()} </br> ${event.distance ? `<b>Distance:</b> ${(event.distance / 1000).toFixed(2)} km` : ""}`
    );
    return eventDetails.join("</br> </br>");
  } else {
    return "Sorry, I couldn't find any event with the provided location.";
  }
};
