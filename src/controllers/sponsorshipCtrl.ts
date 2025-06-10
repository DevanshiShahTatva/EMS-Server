import { Request, Response } from "express";
import Event from "../models/event.model";
import Sponsorship from "../models/sponsorship.model";
import { throwError, getUserIdFromToken } from "../helper/common";
import { saveFileToCloud } from "../helper/cloudniry";
import { appLogger } from "../helper/logger";

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
  const log = appLogger.child({ method: "requestSponsorship" });

  try {
    const { eventId } = req.body;
    const organizerId = getUserIdFromToken(req);

    if (!eventId || !organizerId) {
      return res.status(400).json({
        success: false,
        message: "Missing eventId or organizerId",
      });
    }

    if (await Sponsorship.exists({ eventId, organizerId })) {
      return res.status(400).json({
        success: false,
        message: "Sponsorship request already exists",
      });
    }

    let imageUrl = "";

    // Case 1 - file upload
    const file = req.file as Express.Multer.File;

    if (file) {
      imageUrl = (await saveFileToCloud(file)).url; // result is { url, imageId }
      log.info({ imageUrl }, "Uploaded image to cloud");
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    const request = await Sponsorship.create({
      eventId,
      organizerId,
      status: "pending",
      image: imageUrl,
    });

    await Event.findByIdAndUpdate(eventId, {
      $addToSet: {
        sponsors: {
          orgId: organizerId,
          status: "pending",
          image: imageUrl,
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Sponsorship request submitted",
      data: request,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to create sponsorship request");
    return throwError(res, "Failed to create sponsorship request", 400);
  }
};

export const getAllSponsorshipRequests = async (req: Request, res: Response) => {
  try {
    const requests = await Sponsorship.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching sponsorship requests:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateSponsorshipStatus = async (req: Request, res: Response) => {
  try {
    const { requestId, status } = req.body;

    if (!requestId || !["approved", "rejected"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid requestId or status",
      });
      return;
    }

    const sponsorshipRequest = await Sponsorship.findById(requestId);
    if (!sponsorshipRequest) {
      res.status(404).json({
        success: false,
        message: "Sponsorship request not found",
      });
      return;
    }

    sponsorshipRequest.status = status;
    await sponsorshipRequest.save();

    const updateOperation =
      status === "approved"
        ? {
            $set: {
              "sponsors.$[elem].status": "approved",
            },
          }
        : {
            $pull: {
              sponsors: { orgId: sponsorshipRequest.organizerId.toString() },
            },
          };

    await Event.findByIdAndUpdate(
      sponsorshipRequest.eventId,
      updateOperation,
      status === "approved"
        ? {
            arrayFilters: [{ "elem.orgId": sponsorshipRequest.organizerId.toString() }],
          }
        : {}
    );

    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
      data: sponsorshipRequest,
    });
  } catch (error) {
    console.error("Error updating sponsorship status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
