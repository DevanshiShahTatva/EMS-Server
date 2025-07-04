import mongoose from "mongoose";
import { Request, Response } from "express";
import { ApiResponse, getUserIdFromToken, throwError } from "../helper/common";
import TicketBook from "../models/eventBooking.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import {
  cancelEventTicketMail,
  sendBookingConfirmationEmail,
} from "../helper/nodemailer";
import Stripe from "stripe";
import Event from "../models/event.model";
import { appLogger } from "../helper/logger";
import User from "../models/signup.model";
import PointTransaction from "../models/pointTransaction";
import { CancelCharge } from "../models/cancelCharge.model";
import Voucher from "../models/voucher.model";
import { generateUniquePromoCode } from "../helper/generatePromoCode";
import GroupChat from "../models/groupChat.model";
import { io } from "../server";
import GroupMessage from "../models/groupMessage.model";
import { sendNotification } from "../services/notificationService";
import { SeatBookEmitter } from "../services/seatBookService";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
  typescript: true,
});

const badgeVoucherMap: Record<string, { percentage: number, maxDiscount: number, description: string }> = {
  Silver: {
    percentage: 25,
    maxDiscount: 50,
    description: "25% upto ₹50 discount (One time voucher)",
  },
  Gold: {
    percentage: 50,
    maxDiscount: 100,
    description: "50% upto ₹100 discount (One time voucher)",
  },
};

export const postTicketBook = async (req: Request, res: any) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const rcResponse = new ApiResponse();
    const { eventId, ticketId, seats, totalAmount, discount, paymentId, usedPoints, voucherId, selectedSeats } =
      req.body;

    const parsedSeats = JSON.parse(selectedSeats);

    const selectedSeatIds = parsedSeats.map((seat: { id: string }) => seat.id);

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

    // validate event and ticket - populate the ticket type
    const event = await mongoose
      .model("Event")
      .findOne({ _id: eventId })
      .populate({
        path: "tickets.type",
        select: "name description",
      });

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

    if (
      selectedTicket.totalBookedSeats + Number(seats) >
      selectedTicket.totalSeats
    ) {
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

    const getCharges = await CancelCharge.findOne();

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
          discount: discount || 0,
          selectedSeatsNumbers: parsedSeats,
          cancellationCharge: getCharges.charge
        },
      ],
      { session }
    );

    const userId = await getUserIdFromToken(req);
    if (usedPoints) {
      const user = await User.findById(userId).session(session);
      if (!user) throw new Error("User not found");

      const newPoints = Math.max(0, user.current_points - usedPoints);
      await User.findByIdAndUpdate(
        userId,
        { current_points: newPoints },
        { session }
      );

      await PointTransaction.create(
        [
          {
            userId: userId,
            points: usedPoints,
            activityType: "REDEEM",
            description: `Used in ${event.title} event`,
          },
        ],
        { session }
      );
    } else if (voucherId) {
      const voucher = await Voucher.findOne({ _id: voucherId });
      if (!voucher) throw new Error("Voucher not found");

      if (voucher.appliedBy?.toString() !== userId.toString()) {
        throw new Error("You are not allowed to mark this voucher as used");
      }

      if (voucher.used) {
        throw new Error("Voucher already used");
      }
      voucher.used = true;
      await voucher.save({ session });
    }

    let group = await GroupChat.findOne({ event: eventId }).session(session);
    const adminUser = await User.findOne({ role: "admin" }).session(session);
    if (!group && adminUser) {
      group = new GroupChat({
        event: eventId,
        members: [
          { user: adminUser._id, unreadCount: 0 },
          { user: userId, unreadCount: 0 }
        ],
        admin: adminUser._id,
      });
      await group.save({ session });
    } else if (!group.members.some((member: any) => member.user.equals(userId))) {
      group.members.push({
        user: userId,
        unreadCount: 0
      });
   
      await group.save({ session });

      const newMember = await User.findById(userId)
        .select('name profileimage')
        .lean() as any;

      const systemMessage = new GroupMessage({
        group: group._id,
        isSystemMessage: true,
        systemMessageData: { userId },
        systemMessageType: 'user_joined',
        content: `${newMember?.name ?? "New user"} joined`,
      });
      await systemMessage.save({ session });

      io.to(group._id.toString()).emit('group_member_added', {
        groupId: group._id.toString(),
        members: [{
          id: userId,
          name: newMember?.name ?? "",
          avatar: newMember?.profileimage?.url ?? null
        }]
      });
      io.to(group._id.toString()).emit('new_group_message', systemMessage);
    }

    await session.commitTransaction();
    session.endSession();

    // Reservce Seat
    SeatBookEmitter.emit("reserve-seat", {
      seats: selectedSeatIds,
      user: user,
      event: eventId,
      ticketId: selectedTicket.type._id,
      res: res
    });

    // EMAIL SERVICE
    if (process.env.SEND_EMAILS === "true") {
      try {
        const userData = await mongoose
          .model("User")
          .findById(user)
          .select("email name");

        if (userData) {
          // Get the populated ticket type name
          const ticketTypeName = selectedTicket.type?.name || "";
          setImmediate(() => {
            sendBookingConfirmationEmail(
              userData.email,
              userData.name,
              event.title,
              ticketTypeName,
              seats,
              totalAmount,
              booking._id
            );
          });

          setImmediate(() => {
            sendNotification(user, {
              title: "Ticket Booked",
              body: `You have successfully booked ticket for ${event.title}`,
              data: {
                eventTitle: event.title,
                bookingId: booking._id,
                ticketType: ticketTypeName,
                type: "ticket"
              }
            });

            if (usedPoints) {
              sendNotification(user, {
                title: "Redeem Points",
                body: `You have successfully redeem ${usedPoints} point`,
                data: {
                  type: "reward"
                }
              });
            } else if (voucherId) {
              sendNotification(user, {
                title: "Redeem Voucher",
                body: `You have successfully redeem ${voucherId} voucher`,
                data: {
                  type: "profile"
                }
              });
            };
          });
        }
      } catch (emailError) {
        console.error("Failed to send booking email:", emailError);
      }
    }
    rcResponse.data = booking;
    rcResponse.message = "Ticket booked successfully.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error: any) {

    console.log("error::", error);
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
    const sort: Record<string, 1 | -1> = { created: -1 };

    // find user from token
    const userId = getUserIdFromToken(req);

    rcResponse.data = await TicketBook.find({ user: userId })
      .sort(sort)
      .populate("user")
      .populate({
        path: "event",
        populate: [{ path: "category" }, { path: "tickets.type" }],
      })
      .exec();

    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const cancelBookedEvent = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const userId = await getUserIdFromToken(req);

  try {
    const rcResponse = new ApiResponse();
    const { bookingId } = req.params;

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

    if (!paymentId && !Boolean(booking.totalAmount == 0)) {
      await session.abortTransaction();
      return throwError(
        res,
        "No valid PaymentIntent found for this Checkout Session",
        400
      );
    }

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
      { bookingStatus: "cancelled", cancelledAt: new Date() }
    ).session(session);

    const getCharges = booking.cancellationCharge || 0;

    const charge = (getCharges / 100) * booking.totalAmount;
    const refundAmount = Math.trunc(booking.totalAmount - charge);

    // 7. No refund if pay amount is 0
    if (booking.totalAmount === 0) {
      await TicketBook.findByIdAndUpdate(
        bookingId,
        {
          bookingStatus: "cancelled",
          cancelledAt: new Date(),
          totalAmount: 0,
        },
        { session }
      );

      rcResponse.message = "Booking cancelled successfully";
      rcResponse.data = {
        amount: 0,
        eventTitle: event.title,
        cancelledAt: new Date(),
      };
    } else {
      const refund = await stripe.refunds.create({
        payment_intent: paymentId,
        amount: refundAmount,
        reason: "requested_by_customer",
      });

      // Update booking with cancelled status and adjusted refund
      await TicketBook.findByIdAndUpdate(
        bookingId,
        {
          bookingStatus: "cancelled",
          cancelledAt: new Date(),
          totalAmount: charge,
        },
        { session }
      );

      rcResponse.message = "Booking cancelled and refund processed";
      rcResponse.data = {
        refundId: refund.id,
        amount: refund.amount,
        eventTitle: event.title,
        cancelledAt: new Date(),
      };

      setImmediate(() => {
        cancelEventTicketMail(
          booking.user.email,
          booking.user.name,
          booking.event.title,
          booking.ticket,
          String(refund.amount)
        );
      });

      setImmediate(() => {
        sendNotification(userId, {
          title: "Ticket Cancelled",
          body: `You have been cancelled ticket successfully`,
          data: {
            type: "ticket"
          }
        });
      });
    }

    const seats = booking.selectedSeatsNumbers.map((seat: any) => seat.id);

    // revert reserve booked seat
    SeatBookEmitter.emit("revert-reserve-seat", {
      seats: seats,
      user: userId,
      event: event._id,
      ticketId: ticketType.type,
      res: res
    });

    await session.commitTransaction();
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.log("Error::", error);
    await session.abortTransaction();
    return throwError(res);
  } finally {
    session.endSession(); // Critical cleanup
  }
};

export const validateTicket = async (req: Request, res: Response) => {
  const log = appLogger.child({ method: "validateTicket", body: req.body });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        success: false,
        message: "Invalid Ticket",
      });
    }

    const ticket = await TicketBook.findById(ticketId)
      .populate("event")
      .populate("user")
      .session(session);

    if (!ticket) {
      await session.abortTransaction();
      session.endSession();
      return throwError(res, "Ticket not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // Check is ticket is cancelled or not
    if (ticket.bookingStatus === "cancelled") {
      return throwError(
        res,
        "This ticket has been cancelled",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Check if already marked as attended
    if (ticket.isAttended) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "This ticket has already been used to attend the event.",
      });
    }

    const currentTime = new Date();

    // Ensure event is populated and not expired
    if (!ticket.event || new Date(ticket.event.endDateTime) < currentTime) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Ticket is no longer valid as the event has already ended",
      });
    }

    // Check if current time is within 2 hours of the event's start time
    const eventStartTime = new Date(ticket.event.startDateTime);
    const twoHoursBeforeStart = new Date(eventStartTime.getTime() - 2 * 60 * 60 * 1000);

    if (currentTime < twoHoursBeforeStart) {
      await session.abortTransaction();
      session.endSession();
      return throwError(
        res,
        "Entry is only allowed within 2 hours before the event start time.",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // Mark the ticket as validated
    ticket.isAttended = true;
    await ticket.save();

    const userId = ticket.user._id;
    const eventId = ticket.event._id;
    const isTransactionExist = await PointTransaction.findOne({
      userId: userId,
      eventId: eventId,
      activityType: "EARN",
    });
    if (!isTransactionExist) {
      const pointsToAdd = ticket.event.numberOfPoint ?? 0;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            current_points: pointsToAdd,
            total_earned_points: pointsToAdd,
          },
        },
        { new: true, session }
      );
      const attendedCount = await TicketBook.countDocuments({
        user: userId,
        isAttended: true,
      }).session(session);

      let newBadge = "Bronze";
      if (updatedUser.total_earned_points >= 2000 || attendedCount >= 10) {
        newBadge = "Gold";
      } else if (updatedUser.total_earned_points >= 1000) {
        newBadge = "Silver";
      }

      if (updatedUser.current_badge !== newBadge) {
        await User.updateOne(
          { _id: userId },
          { current_badge: newBadge },
          { session }
        );
        if (badgeVoucherMap[newBadge]) {
          const { percentage, maxDiscount, description } = badgeVoucherMap[newBadge];
          const promoCode = await generateUniquePromoCode();
          const expireTime = new Date();
          expireTime.setMonth(expireTime.getMonth() + 1);

          await Voucher.create(
            [{
              userId,
              promoCode,
              expireTime,
              percentage,
              maxDiscount,
              used: false,
              description,
            }],
            { session }
          );
        }
      }

      await PointTransaction.create(
        [
          {
            userId: userId,
            eventId: eventId,
            points: pointsToAdd,
            activityType: "EARN",
            description: `Attended ${ticket.event.title} event`,
          },
        ],
        { session }
      );
    }
    await session.commitTransaction();
    session.endSession();

    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      data: "Validate",
      message: "Ticket validated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    log.error({ err: error }, "Error validating your tickets");
    return throwError(
      res,
      "Failed to validate ticket",
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
};
