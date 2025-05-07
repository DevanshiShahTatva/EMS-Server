import { Request, Response } from "express";
import {
  ApiResponse,
  create,
  find,
  findOne,
  updateOne,
  throwError,
  deleteOne,
  getUserIdFromToken,
} from "../helper/common";
import { deleteFromCloudinary, saveFileToCloud } from "../helper/cloudniry";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import Event, { FeedbackModel } from "../models/event.model";
import mongoose, { Types } from "mongoose";
import TicketBook from "../models/eventBooking.model";

export const postEvent = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const files = req.files as Express.Multer.File[];
    const body = req.body;

    const imageUrls = await Promise.all(
      files.map((file) => saveFileToCloud(file))
    );

    const eventData = {
      ...body,
      images: imageUrls,
    };

    rcResponse.data = await create("Event", eventData);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err: any) {
    if (err.name === "ValidationError") {
      return throwError(res, err.message, HTTP_STATUS_CODE.BAD_REQUEST);
    } else {
      return throwError(res);
    }
  }
};

export const getEvents = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);

    const pipeline: any[] = [
      { $match: {} },
      { $sort: { created: -1 } },
      // Add computed fields.
      {
        $addFields: {
          // Use $ifNull to default missing likes to an empty array, then compute the size.
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          // Check if the authenticated user's ObjectId exists in the likes array.
          isLiked: userId
            ? {
                $in: [
                  new mongoose.Types.ObjectId(userId),
                  { $ifNull: ["$likes", []] },
                ],
              }
            : false,
        },
      },
      // Optionally remove the raw likes array from the result.
      {
        $project: {
          likes: 0,
          __v: 0
        },
      },
    ];

    // Execute the aggregation pipeline on the Event collection.
    const events = await Event.aggregate(pipeline);

    rcResponse.data = events;
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const getEventById = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const userId = getUserIdFromToken(req);
    const eventId = req.params.id;

    const pipeline: any[] = [
      // Match the event by its _id.
      { $match: { _id: new Types.ObjectId(eventId) } },
      // Add computed fields: likesCount and isLiked.
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          isLiked: userId
            ? {
                $in: [
                  new Types.ObjectId(userId),
                  { $ifNull: ["$likes", []] },
                ],
              }
            : false,
        },
      },
      // Project to remove the raw 'likes' array from the output.
      { $project: { likes: 0, __v: 0 } },
    ];

    const eventResult = await Event.aggregate(pipeline);

    // If no event is found, return an error.
    if (!eventResult || eventResult.length === 0) {
      return throwError(res, "Event not found");
    }

    rcResponse.data = eventResult[0];
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const putEvent = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const files = req.files as Express.Multer.File[];
    const eventId = req.params.id;

    // 1. Find existing event
    const findEvent = await findOne("Event", { _id: eventId });
    if (!findEvent) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // 2. Parse existing image IDs
    const existingImageIds = req.body.existingImages
      ? JSON.parse(req.body.existingImages)
      : [];

    // 3. Validate existing images belong to the event
    const currentPublicIds = findEvent.images.map((img: any) => img.imageId);
    const invalidIds = existingImageIds.filter(
      (id: string) => !currentPublicIds.includes(id)
    );
    if (invalidIds.length > 0) {
      return throwError(
        res,
        "Invalid image references",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    // 4. Process images to keep and delete
    const imagesToKeep = findEvent.images.filter((img: any) =>
      existingImageIds.includes(img.imageId)
    );
    const imagesToDelete = findEvent.images.filter(
      (img: any) => !existingImageIds.includes(img.imageId)
    );

    // 5. Upload new images
    const newImages = await Promise.all(
      files.map((file) => saveFileToCloud(file))
    );

    // 6. Prepare updated data
    const updatedEventData = {
      ...req.body,
      images: [...imagesToKeep, ...newImages],
    };

    // 7. Update database first
    const result = await updateOne("Event", { _id: eventId }, updatedEventData);

    // 8. Delete old images after successful update
    await Promise.all(
      imagesToDelete.map((img: any) => deleteFromCloudinary(img.imageId))
    );

    rcResponse.data = result;
    rcResponse.message = "Event updated successfully.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err: any) {
    return throwError(res);
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const eventId = req.params.id;
    let sort = { created: -1 };

    const event = await findOne("Event", { _id: eventId }, sort);
    if (!event) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // CHECK IF BOOKINGS ARE EXISTING BEFORE DELETION
    const bookingCount = await TicketBook.countDocuments({ event: eventId });
    if (bookingCount > 0) {
      return throwError(
        res,
        "Event can not be deleted due to existing bookings.",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    if (event.images && event.images.length > 0) {
      await Promise.all(
        event.images.map(async (image: { imageId: string }) => {
          await deleteFromCloudinary(image.imageId);
        })
      );
    }

    rcResponse.data = await deleteOne("Event", { _id: eventId });
    rcResponse.message = "Event deleted successfully.";

    return res.status(rcResponse.status).send(rcResponse);
  } catch (err: any) {
    return throwError(res);
  }
};

export const likeEvent = async (req: Request, res: Response) => {
  try {
    const rcResponse = new ApiResponse();
    const eventId = req.params.id;
    const userId = new Types.ObjectId(getUserIdFromToken(req));

    // Solution 1: Use native Mongoose methods with proper typing
    const event = await Event.findById(eventId).select("likes").lean() as any;
    
    if (!event) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // Check if user already liked
    const hasLiked = event.likes.some((likeId: any) => 
      likeId.toString() === userId.toString()
    );

    // Atomic update operation
    const update = hasLiked
      ? { $pull: { likes: userId } } // Unlike
      : { $push: { likes: userId } }; // Like

    // Perform the update and get the updated document
    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      update,
      { 
        new: true,
        projection: { likes: 1, __v: 0 } // Only return the likes field
      }
    ).lean() as any;

    if (!updatedEvent) {
      return throwError(res, "Update failed", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
    }

    rcResponse.data = {
      likesCount: updatedEvent.likes.length,
      isLiked: !hasLiked
    };

    return res.status(rcResponse.status).send(rcResponse);

  } catch (err) {
    return throwError(res);
  }
};

export const feedbackEvent = async(req:Request,res:Response)=>{
  try {
    const rcResponse = new ApiResponse()

    const { name, email, rating, description } = req.body
    
    if (!name || !email || !rating) {
      return throwError(res, 'Name, email, and rating are required', HTTP_STATUS_CODE.BAD_REQUEST)
    }

    // Save feedback to DB
    const feedback = await FeedbackModel.create({
      name,
      email,
      rating,
      description,
    })

    rcResponse.data = {
      message: 'Feedback submitted successfully',
      feedbackId: feedback._id,
    }

    return res.status(rcResponse.status).send(rcResponse)

  } catch (res) {
    return throwError(res)
  }
}