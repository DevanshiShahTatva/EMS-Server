import mongoose, { Schema } from "mongoose";
import { ITicketType } from "./ticketType.model";

interface ISeatRows {
  row: string;
  seats: [{ seatNumber: string; isUsed: boolean }];
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
        row: String,
        seats: [{ seatNumber: String, isUsed: Boolean }],
      },
    ],
    default: [],
  },
});

const seatLayoutSchema = new mongoose.Schema({
  event: {
    type: Schema.Types.ObjectId,
    ref: "Event",
    require: true
  },
  seatLayout: {
    type: [SeatLayoutSchema],
    default: [],
  },
});

export const SeatLayout =
  mongoose.models.SeatLayout || mongoose.model("SeatLayout", seatLayoutSchema);
