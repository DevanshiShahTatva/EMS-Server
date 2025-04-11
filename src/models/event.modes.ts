import mongoose, { Schema, Document } from "mongoose";
import { CATEGORY_ENUM } from "../utilits/enum";

interface ITicket {
  type: string;
  price?: number;
  totalSeats: number;
  totalBookedSeats: number;
  description?: string;
}

interface IEvent extends Document {
  title: string;
  description: string;
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  startDateTime: Date;
  endDateTime: Date;
  duration: string;
  category: string;
  tickets: ITicket[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>({
  type: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    min: 0,
  },
  totalSeats: {
    type: Number,
    required: true,
    min: 1,
  },
  totalBookedSeats: { type: Number, default: 0 },
  description: {
    type: String,
  },
});

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 100,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      minlength: 20,
    },
    location: {
      address: {
        type: String,
        required: true,
      },
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    startDateTime: {
      type: Date,
      required: true,
    },
    endDateTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: IEvent, value: Date) {
          return value > this.startDateTime;
        },
        message: "End date/time must be after start date/time",
      },
    },
    duration: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: CATEGORY_ENUM,
      required: true,
    },
    tickets: {
      type: [TicketSchema],
      validate: {
        validator: function (tickets: ITicket[]) {
          return tickets.length > 0;
        },
        message: "At least one ticket type is required",
      },
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
