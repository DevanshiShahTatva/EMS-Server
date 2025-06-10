import mongoose, { Schema, Document } from "mongoose";
import { ITicketCategory } from "./ticketCategory.model";
import { ITicketType } from "./ticketType.model";

interface ITicket {
  type: ITicketType;
  price?: number;
  totalSeats: number;
  totalBookedSeats: number;
  description?: string;
}

interface ISeatRows {
  row: string;
  seats: [{ seatNumber: string, isUsed: boolean }]
}

interface ISeatLayout {
  ticketType: ITicketType,
  price: number,
  rows: ISeatRows[]
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
  category: ITicketCategory;
  tickets: ITicket[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  likes: Array<mongoose.Schema.Types.ObjectId>;
  likesCount: Number;
  isLiked: Boolean;
  numberOfPoint: number;
  seatLayout: ISeatLayout[],
  eventMode: string;
}

const TicketSchema = new Schema<ITicket>({
  type: {
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: "TicketType",
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
    type : [
      { 
        row: String,
        seats: [{ seatNumber: String, isUsed: Boolean }]
      }
    ],
    default: []
  }
});

const LocationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
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
  { _id: false }
);

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
      type: LocationSchema,
      required: true,
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "TicketCategory",
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
    images: {
      type: [
        {
          imageId: String,
          url: String,
        },
      ],
      validate: {
        validator: function (imgs: Array<{ imageId: string; url: string }>) {
          return imgs.length >= 1 && imgs.length <= 4;
        },
        message: "Must have between 1 and 4 images",
      },
      required: true,
    },
    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    isLiked: { type: Boolean, default: false },
    likesCount: { type: Number, default: 0 },
    numberOfPoint: { type: Number, default: 0 },
    seatLayout: {
      type: [SeatLayoutSchema],
      default: []
    },
    eventMode: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      defalut: "OFFLINE"
    }
  },
  {
    timestamps: true,
  }
);

EventSchema.index({ location: "2dsphere" });

const Event =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
