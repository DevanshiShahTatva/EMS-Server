import mongoose from "mongoose";
import { Request } from "express";
import { ApiResponse, find, findOne, getUserIdFromToken, throwError } from "../helper/common";
import jwt from "jsonwebtoken";
import TicketBook from "../models/eventBooking.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";

export const postTicketBook = async (req: Request, res: any) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const rcResponse = new ApiResponse();
    const { eventId, ticketId, seats, totalAmount, paymentId } = req.body;

    // find user from token
    const user = getUserIdFromToken(req);

    // validate body data
    if (![eventId, ticketId, seats].every(Boolean) || seats < 1) {
      return throwError(res, "Invalida request Parameters", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    // validate event and ticket
    const event = await findOne("Event", { _id: eventId });
    if (!event) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    const selectedTicket = event.tickets.find(
      (ticket: any) => ticket._id.toString() === ticketId
    );
    if (!selectedTicket) {
      return throwError(res, "Ticket type not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    if (selectedTicket.totalBookedSeats + seats > selectedTicket.totalSeats) {
      return throwError(res, "Not enough available seats", HTTP_STATUS_CODE.BAD_REQUEST);
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
      return throwError(res, "Failed to update ticket seats", HTTP_STATUS_CODE.BAD_REQUEST);
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
      return throwError(res, "Duplicate payment detected", HTTP_STATUS_CODE.BAD_REQUEST);
    }
    return throwError(res);
  }
};

export const getTicketBooks = async (req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    let sort = { created: -1 };

    // find user from token
    const userId = getUserIdFromToken(req);

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
