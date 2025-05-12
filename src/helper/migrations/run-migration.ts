import 'dotenv/config'; // Add this at the very top
import mongoose from "mongoose";
import TicketBook from '../../models/eventBooking.model';

async function runMigration() {
  try {
    // Verify environment variable exists
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Your migration logic here
    const statusResult = await TicketBook.updateMany(
      { bookingStatus: { $exists: false } },
      { $set: { bookingStatus: "booked" } }
    );

    const cancelledAtResult = await TicketBook.updateMany(
      { cancelledAt: { $exists: false } },
      { $set: { cancelledAt: null } }
    );

    console.log(`
      Migration completed:
      - BookingStatus updated: ${statusResult.modifiedCount} documents
      - CancelledAt updated: ${cancelledAtResult.modifiedCount} documents
    `);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();