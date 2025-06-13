import { EventEmitter } from "events";
import { SeatLayout } from "../models/seatLayout.model";
import mongoose from "mongoose";

export const SeatBookEmitter = new EventEmitter();

SeatBookEmitter.on("reserve-seat", async (data) => {
  try {
    const { seats, event, ticketId, user } = data;

    const layoutDoc = await SeatLayout.findOne({ event });

    if (!layoutDoc) {
      console.error("Seat layout not found for event:", event);
      return;
    }

    let updated = false;

    layoutDoc.seatLayout.forEach((section: any) => {
      if (String(section.ticketType) !== String(ticketId)) return;

      section.rows.forEach((row: any) => {
        row.seats.forEach((seat: any) => {
          const seatIdStr = String(seat._id);
          if (seats.includes(seatIdStr)) {
            if (!seat.isBooked) {
              seat.isBooked = true;
              seat.user = new mongoose.Types.ObjectId(user);
              updated = true;
            } else {
              console.warn(`Seat ${seatIdStr} is already booked.`);
            }
          }
        });
      });
    });

    if (updated) {
      await layoutDoc.save();
      console.log("✅ Seats reserved successfully.");
    } else {
      console.warn("No seats were updated. Possibly already booked or invalid IDs.");
    }
  } catch (error) {
    console.error("❌ Error reserving seats:", error);
  }
});

SeatBookEmitter.on("revert-reserve-seat", async (data) => {
  try {
    const { seats, event, ticketId, user } = data;

    const layoutDoc = await SeatLayout.findOne({ event });

    if (!layoutDoc) {
      console.error("Seat layout not found for event:", event);
      return;
    }

    let updated = false;

    layoutDoc.seatLayout.forEach((section: any) => {
      if (String(section.ticketType) !== String(ticketId)) return;

      section.rows.forEach((row: any) => {
        row.seats.forEach((seat: any) => {
          const seatIdStr = String(seat._id);
          if (seats.includes(seatIdStr)) {
            if (seat.isBooked && String(seat.user) === String(user)) {
              seat.isBooked = false;
              seat.user = null;
              updated = true;
            }
          }
        });
      });
    });

    if (updated) {
      await layoutDoc.save();
      console.log("✅ Seats reverted (cancelled) successfully.");
    } else {
      console.warn("No seats were reverted. They may already be unbooked or user mismatch.");
    }
  } catch (error) {
    console.error("Error reverting seat reservation:", error);
  }
});
