import mongoose from "mongoose";

const ticketBookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", require: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", require: true },
  ticket: { type: String, require: true },
  seats: { type: Number, require: true, min: 1 },
  totalAmount: { type: Number, require: true },
  paymentId: { type: String, require: true, unique: true },
  bookingDate: { type: Date, default: Date.now },
  bookingStatus: { type: String, default: "booked" },
  cancelledAt: { type: Date, default: null }
});

const TicketBook =
  mongoose.models.TicketBook || mongoose.model("TicketBook", ticketBookingSchema);

export default TicketBook;
