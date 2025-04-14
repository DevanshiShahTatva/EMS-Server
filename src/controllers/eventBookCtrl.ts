import mongoose from "mongoose";
import { Request } from "express";
import { ApiResponse, find, findOne, throwError } from "../helper/common";
import jwt from "jsonwebtoken";
import TicketBook from "../models/eventBooking.model";

export const postTicketBook = async (req: Request, res: any) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const rcResponse = new ApiResponse();
    const token = req.headers["token"] as string;
    const { eventId, ticketId, seats, totalAmount, paymentId } = req.body;

    // find user from token
    const secretKey = process.env.TOKEN_SECRET as string;
    const tokenUser = jwt.verify(token, secretKey) as any;
    const user = tokenUser._id;

    // validate body data
    if (![eventId, ticketId, seats].every(Boolean) || seats < 1) {
      return throwError(res, "Invalida request Parameters", 400);
    }

    // validate event and ticket
    const event = await findOne("Event", { _id: eventId });
    if (!event) {
      return throwError(res, "Event not found", 404);
    }

    const selectedTicket = event.tickets.find(
      (ticket: any) => ticket._id.toString() === ticketId
    );
    if (!selectedTicket) {
      return throwError(res, "Ticket type not found", 404);
    }

    if (selectedTicket.totalBookedSeats + seats > selectedTicket.totalSeats) {
      return throwError(res, "Not enough available seats", 402);
    }

    const updateResult = await mongoose.model("Event").updateOne(
      {
        _id: eventId,
        "tickets._id": ticketId,
      },
      {
        $inc: { "tickets.$.totalBookedSeats": seats },
      },
      { session }
    );

    if (updateResult.matchedCount === 0) {
      return throwError(res, "Failed to update ticket seats", 402);
    }

    rcResponse.data = await TicketBook.create(
      [
        {
          event: eventId,
          ticket: ticketId,
          user,
          seats,
          totalAmount,
          paymentId,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    rcResponse.message = "Ticket book successfully.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    if (error.code === 11000) {
      return throwError(res, "Duplicate payment detected", 402);
    }
    return throwError(res);
  }
};

export const getTicketBooks = async (req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    const token = req.headers["token"] as string;
    let sort = { created: -1 };

    // find user from token
    const secretKey = process.env.TOKEN_SECRET as string;
    const tokenUser = jwt.verify(token, secretKey) as any;
    const userId = tokenUser._id;

    const populates = ["user", "event"];

    rcResponse.data = await find(
      "TicketBook",
      { user: userId },
      sort,
      populates
    );
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};
