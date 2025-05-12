import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function with better error handling
const uploadFromBuffer = (file: Express.Multer.File): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Check if file buffer exists
    if (!file?.buffer) {
      return reject(new Error("Invalid file buffer"));
    }

    // Create Cloudinary stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "event-images",
        resource_type: "image",
        // allowed_formats: ["jpg", "jpeg", "png", "webp"],
        // resource_type: "auto"
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary upload failed"));
        }
        resolve({
          url: result.secure_url,
          imageId: result.public_id,
        });
      }
    );

    // Pipe buffer to stream
    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

export const saveFileToCloud = async (
  file: Express.Multer.File
): Promise<{ url: string; imageId: string }> => {
  try {
    return await uploadFromBuffer(file);
  } catch (error) {
    console.error("File upload failed:", error);
    throw new Error(
      `File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== "ok") {
      throw new Error(`Failed to delete asset: ${publicId}`);
    }
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    throw new Error(`Failed to delete asset: ${publicId}`);
  }
};
