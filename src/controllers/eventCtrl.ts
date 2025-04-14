import { Request } from "express";
import {
  ApiResponse,
  create,
  find,
  findOne,
  updateOne,
  throwError,
  deleteOne,
} from "../helper/common";
import { deleteFromCloudinary, saveFileToCloud } from "../helper/cloudniry";
import { HTTP_STATUS_CODE } from "../utilits/enum";

export const postEvent = async (req: Request, res: any) => {
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

export const getEvents = async (_req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    let sort = { created: -1 };

    rcResponse.data = await find("Event", {}, sort);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const getEventById = async (req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    const eventId = req.params.id;
    let sort = { created: -1 };

    rcResponse.data = await findOne("Event", { _id: eventId }, sort);
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    return throwError(res);
  }
};

export const putEvent = async (req: Request, res: any) => {
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

export const deleteEvent = async (req: Request, res: any) => {
  try {
    const rcResponse = new ApiResponse();
    const eventId = req.params.id;
    let sort = { created: -1 };

    const event = await findOne("Event", { _id: eventId }, sort);
    if (!event) {
      return throwError(res, "Event not found", HTTP_STATUS_CODE.NOT_FOUND);
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
