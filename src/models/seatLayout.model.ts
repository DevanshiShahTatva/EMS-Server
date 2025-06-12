import mongoose, { Schema } from "mongoose";
import { ITicketType } from "./ticketType.model";

interface ISeat {
  seatNumber: string;
  isUsed: boolean;
  isBooked?: boolean;
  user?: mongoose.Types.ObjectId;
}

interface ISeatRows {
  row: string;
  seats: ISeat[];
}

interface ISeatLayout {
  ticketType: ITicketType;
  price: number;
  rows: ISeatRows[];
}

const SeatLayoutSchema = new Schema<ISeatLayout>({
  ticketType: {
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: "TicketType",
  },
  price: {
    type: Number,
    min: 0,
  },
  rows: {
    type: [
      {
        row: { type: String, required: true },
        seats: [
          {
            seatNumber: { type: String, required: true },
            isUsed: { type: Boolean, default: false },
            isBooked: { type: Boolean, default: false },
            user: { type: Schema.Types.ObjectId, ref: "User", default: null },
          },
        ],
      },
    ],
    default: [],
  },
});

const seatLayoutSchema = new mongoose.Schema({
  event: {
    type: Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  seatLayout: {
    type: [SeatLayoutSchema],
    default: [],
  },
});

export const SeatLayout =
  mongoose.models.SeatLayout || mongoose.model("SeatLayout", seatLayoutSchema);
