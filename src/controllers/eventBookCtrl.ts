import mongoose from "mongoose";
import { Request, Response } from "express";
import {
  ApiResponse,
  find,
  findOne,
  getUserIdFromToken,
  throwError,
} from "../helper/common";
import TicketBook from "../models/eventBooking.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import {
  cancelEventTicketMail,
  sendBookingConfirmationEmail,
} from "../helper/nodemailer";
import Stripe from "stripe";
import Event from "../models/event.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
  typescript: true,
});

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
      return throwError(
        res,
        "Invalid request Parameters",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
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
      return throwError(
        res,
        "Ticket type not found",
        HTTP_STATUS_CODE.NOT_FOUND
      );
    }

    if (selectedTicket.totalBookedSeats + seats > selectedTicket.totalSeats) {
      return throwError(
        res,
        "Not enough available seats",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
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
      return throwError(
        res,
        "Failed to update ticket seats",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Store the created booking in a variable
    const [booking] = await TicketBook.create(
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

    // EMAIL SERVICE
    if (process.env.SEND_EMAILS === "true") {
      try {
        const userData = await mongoose
          .model("User")
          .findById(user)
          .select("email name");

        if (userData) {
          await sendBookingConfirmationEmail(
            userData.email,
            userData.name,
            event.title,
            selectedTicket.type,
            seats,
            totalAmount,
            booking._id
          );
        }
      } catch (emailError) {
        console.error("Failed to send booking email:", emailError);
      }
    }

    rcResponse.data = booking; // Return the booking in the response
    rcResponse.message = "Ticket booked successfully.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();

    if (error.code === 11000) {
      return throwError(
        res,
        "Duplicate payment detected",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
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

export const cancelBookedEvent = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rcResponse = new ApiResponse();
    const { bookingId } = req.params;
    const userId = await getUserIdFromToken(req);

    // 1. Find the booking
    const booking = await TicketBook.findById(bookingId)
      .populate("user")
      .populate("event")
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      return throwError(res, "Booking not found", 404);
    }

    // 2. Verify ownership
    if (booking.user._id.toString() !== userId.toString()) {
      await session.abortTransaction();
      return throwError(res, "Unauthorized to cancel this booking", 403);
    }

    // 3. Check if event is in the past
    const paymentSession = await stripe.checkout.sessions.retrieve(
      booking.paymentId
    );
    const paymentId = paymentSession.payment_intent as string;

    if (!paymentId) {
      return throwError(
        res,
        "No valid PaymentIntent found for this Checkout Session",
        400
      );
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentId,
      amount: booking.totalAmount ? booking.totalAmount : undefined,
      reason: "requested_by_customer",
    });

    // 5. Update ticket availability
    const event = await Event.findById(booking.event).session(session);
    const ticketType = event.tickets.find(
      (t: any) => t.id.toString() === booking.ticket
    );

    if (!ticketType) {
      await session.abortTransaction();
      return throwError(res, "Ticket type no longer exists", 400);
    }

    ticketType.totalBookedSeats = Math.max(
      0,
      ticketType.totalBookedSeats - booking.seats
    );

    // 6. Save changes and delete booking
    await event.save({ session });
    await TicketBook.findByIdAndUpdate(
      { _id: bookingId },
      { bookingStatus: "cancelled" }
    ).session(session);

    await session.commitTransaction();

    rcResponse.message = "Booking cancelled and refund processed";
    rcResponse.data = {
      refundId: refund.id,
      amount: refund.amount,
      eventTitle: event.title,
      cancelledAt: new Date(),
    };

    cancelEventTicketMail(
      booking.user.email,
      booking.user.name,
      booking.event.title,
      booking.ticket,
      booking.totalAmount
    );
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("Error::", error);
    return throwError(res);
  }
};
