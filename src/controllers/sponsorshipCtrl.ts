import { Request, Response } from "express";
import Event from "../models/event.model";
import Sponsorship from "../models/sponsorship.model";
import { throwError, getUserIdFromToken } from "../helper/common";

export const getUpcomingEvents = async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();

    const upcomingEvents = await Event.find({
      startDateTime: { $gt: currentDate },
    }).sort({ startDateTime: 1 });

    res.status(200).json({
      success: true,
      data: upcomingEvents,
    });
  } catch (error) {
    return throwError(error, "Failed to fetch upcoming events", 400);
  }
};

export const requestSponsorship = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body;
    const organizerId = getUserIdFromToken(req);

    if (!eventId || !organizerId) {
      return res.status(400).json({
        success: false,
        message: "Missing eventId or organizerId",
      });
    }

    const existingRequest = await Sponsorship.findOne({
      eventId,
      organizerId,
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Sponsorship request already exists",
      });
    }

    const request = new Sponsorship({
      eventId,
      organizerId,
      status: 'pending',
    });

    await request.save();

    // Add to event's sponsors array with pending status
    await Event.findByIdAndUpdate(
      eventId,
      {
        $addToSet: {
          sponsors: {
            orgId: organizerId,
            status: "pending"
          }
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Sponsorship request submitted",
      data: request,
    });

  } catch (error) {
    return throwError(res, "Failed to create sponsorship request", 400);
  }
};

export const getAllSponsorshipRequests = async (req: Request, res: Response) => {
  try {
    const requests = await Sponsorship.find().sort({ createdAt: -1 })
    res.status(200).json({ success: true, data: requests })
  } catch (error) {
    console.error('Error fetching sponsorship requests:', error)
    res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}

export const updateSponsorshipStatus = async (req: Request, res: Response): Promise<void> => {
   try {
    const { requestId, status } = req.body;

    if (!requestId || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ message: "Invalid requestId or status" });
      return;
    }

    // Find sponsorship request by ID
    const sponsorshipRequest = await Sponsorship.findById(requestId);
    if (!sponsorshipRequest) {
      res.status(404).json({ message: "Sponsorship request not found" });
      return;
    }

    // Update sponsorship request status
    sponsorshipRequest.status = status;
    await sponsorshipRequest.save();

    // Update event's sponsors array
    const updateOperation = status === "approved"
  ? {
      $addToSet: {
        sponsors: {
          orgId: sponsorshipRequest.organizerId.toString(),
          status: "approved"
        }
      }
    }
  : {
      $pull: {
        sponsors: { orgId: sponsorshipRequest.organizerId.toString() }
      }
    };

    await Event.findByIdAndUpdate(
      sponsorshipRequest.eventId,
      updateOperation
    );

    res.status(200).json({ 
      message: `Request ${status} successfully`, 
      sponsorshipRequest 
    });
  } catch (error) {
    console.error("Error updating sponsorship status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
