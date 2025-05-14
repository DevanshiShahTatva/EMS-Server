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
import Event from "../models/event.model";
import mongoose, { Types } from "mongoose";
import TicketBook from "../models/eventBooking.model";
import { appLogger } from "../helper/logger";

export const postEvent = async (req: Request, res: Response) => {
  const log = appLogger.child({ method: 'postEvent' });
  try {
    const rcResponse = new ApiResponse();
    const files = req.files as Express.Multer.File[];
    const body = req.body;

    // Convert category to ObjectId
    const categoryId = mongoose.isValidObjectId(body.category)
      ? new mongoose.Types.ObjectId(body.category)
      : "";

    // log.info("Uploading images to cloud...");
    const imageUrls = await Promise.all(
      files.map((file) => saveFileToCloud(file))
    );

    const eventData = {
      ...body,
      category: categoryId,
      images: imageUrls,
    };

    // log.info("Creating event with data", { eventData });
    rcResponse.data = await create("Event", eventData);

    // log.info("Event created successfully", { eventId: rcResponse.data._id });
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err: any) {
    log.error({ err }, "Error creating event");
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

      // Populate category
      {
        $lookup: {
          from: "ticketcategories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Step 1: Unwind tickets
      { $unwind: { path: "$tickets", preserveNullAndEmptyArrays: true } },

      // Step 2: Lookup ticket type and store as "ticketType"
      {
        $lookup: {
          from: "tickettypes",
          let: { typeId: "$tickets.type" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$typeId"] } } },
            { $project: { __v: 0 } },
          ],
          as: "tickets.type",
        },
      },
      {
        $addFields: {
          "tickets.type": { $arrayElemAt: ["$tickets.type", 0] },
        },
      },

      // Step 3: Regroup tickets into an array
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          tickets: { $push: "$tickets" },
        },
      },
      {
        $addFields: {
          "doc.tickets": "$tickets",
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },

      // ✅ Sort here — after all restructuring
      { $sort: { createdAt: -1 } },

      // Step 4: Add likes and isLiked
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } },
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

      // Step 5: Cleanup fields
      {
        $project: {
          likes: 0,
          __v: 0,
        },
      },
    ];

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
      // Match the event by its _id
      { $match: { _id: new Types.ObjectId(eventId) } },

      // Populate category
      {
        $lookup: {
          from: "ticketcategories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

      // Unwind tickets to process each one
      { $unwind: { path: "$tickets", preserveNullAndEmptyArrays: true } },

      // Lookup ticket type for each ticket
      {
        $lookup: {
          from: "tickettypes",
          localField: "tickets.type",
          foreignField: "_id",
          as: "tickets.type",
        },
      },
      { $unwind: { path: "$tickets.type", preserveNullAndEmptyArrays: true } },

      // Regroup tickets back into an array
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          tickets: { $push: "$tickets" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$doc", { tickets: "$tickets" }],
          },
        },
      },

      // Add computed fields
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

      // Project to remove unnecessary fields
      {
        $project: {
          likes: 0,
          __v: 0,
          "category.__v": 0,
          "tickets.type.__v": 0,
        },
      },
    ];

    const eventResult = await Event.aggregate(pipeline);

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
      category: mongoose.isValidObjectId(req.body.category) ? new mongoose.Types.ObjectId(req.body.category) : "",
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
  const log = appLogger.child({ method: 'deleteEvent' });
  try {
    const rcResponse = new ApiResponse();
    const eventId = req.params.id;
    const sort = { created: -1 };

    // log.info({ eventId }, "Attempting to find event for deletion");
    const event = await findOne("Event", { _id: eventId }, sort);
    if (!event) {
      // log.warn({ eventId }, "Event not found");
      return throwError(res, "Event not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    // log.info({ eventId }, "Checking for existing bookings");
    const bookingCount = await TicketBook.countDocuments({ event: eventId });
    if (bookingCount > 0) {
      // log.warn({ eventId, bookingCount }, "Cannot delete event with existing bookings");
      return throwError(
        res,
        "Event can not be deleted due to existing bookings.",
        HTTP_STATUS_CODE.BAD_REQUEST
      );
    }

    if (event.images && event.images.length > 0) {
      // log.info({ imageCount: event.images.length }, "Attempting to delete images from Cloudinary");
      await Promise.all(
        event.images.map(async (image: { imageId: string }) => {
          try {
            await deleteFromCloudinary(image.imageId);
            // log.info({ imageId: image.imageId }, "Image deleted from Cloudinary");
          } catch (cloudErr) {
            log.error({ imageId: image.imageId, err: cloudErr }, "Failed to delete image from Cloudinary");
          }
        })
      );
    }

    // log.info({ eventId }, "Deleting event from database");
    rcResponse.data = await deleteOne("Event", { _id: eventId });
    rcResponse.message = "Event deleted successfully.";

    // log.info({ eventId }, "Event deleted successfully");
    return res.status(rcResponse.status).send(rcResponse);
  } catch (err: any) {
    log.error({ err, eventId: req.params.id }, "Error deleting event");
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

