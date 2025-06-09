import { Request, Response } from "express";
import Event from "../models/event.model";
import Sponsorship from "../models/sponsorship.model";
import { throwError, getUserIdFromToken } from "../helper/common";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    const { eventId, image } = req.body;
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
      status: "pending",
      image,
    });

    await request.save();

    // Add to event's sponsors array with pending status
    await Event.findByIdAndUpdate(eventId, {
      $addToSet: {
        sponsors: {
          orgId: organizerId,
          status: "pending",
          image,
        },
      },
    });

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
    const requests = await Sponsorship.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching sponsorship requests:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateSponsorshipStatus = async (req: Request, res: Response): Promise<void> => {
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

    if (status === "approved") {
      // Update existing sponsor or add if not exists
      await Event.findByIdAndUpdate(
        sponsorshipRequest.eventId,
        {
          $set: {
            "sponsors.$[elem].status": "approved",
          },
        },
        {
          arrayFilters: [{ "elem.orgId": sponsorshipRequest.organizerId.toString() }],
          new: true,
        }
      ).then(async (result) => {
        // If no matching sponsor was found, add a new one
        if (
          !result ||
          result.sponsors.find((s: any) => s.orgId === sponsorshipRequest.organizerId.toString()) === undefined
        ) {
          await Event.findByIdAndUpdate(sponsorshipRequest.eventId, {
            $addToSet: {
              sponsors: {
                orgId: sponsorshipRequest.organizerId.toString(),
                status: "approved",
                image: sponsorshipRequest.image,
              },
            },
          });
        }
      });
    } else {
      // For rejected status, remove the sponsor
      await Event.findByIdAndUpdate(sponsorshipRequest.eventId, {
        $pull: {
          sponsors: { orgId: sponsorshipRequest.organizerId.toString() },
        },
      });
    }

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

export const generateSponsorBanner = async (req: Request, res: Response) => {
  console.log("Request body:", req.body);

  try {
    const { bgUrl, centerText } = req.body;

    const prompt = `
      Create a high-quality banner image.
      - Background: ${bgUrl}
      - Center Text: "${centerText}"
      
      Overlay the text in a visually appealing way, center-aligned. Return only the image.
    `;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-vision" });

    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const imageBase64 = await response.text(); // or other format Gemini returns

    res.send({
      success: true,
      image: imageBase64,
    });
  } catch (err) {
    console.error("Image generation failed:", err);
    res.status(500).send({ success: false, message: "Image generation failed." });
  }
};
