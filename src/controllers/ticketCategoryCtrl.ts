import { Request, Response } from 'express';
import { appLogger } from '../helper/logger';
import { throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';
import mongoose from 'mongoose';
import TicketCategory from '../models/ticketCategory.model';
import { deleteFromCloudinary, saveFileToCloud } from '../helper/cloudniry';

export const getAllTicketCategories = async (_req: Request, res: Response) => {
    const log = appLogger.child({ method: 'getAllTicketCategories' });

    try {
        const ticketCategories = await TicketCategory.find().sort({ createdAt: -1 });
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: ticketCategories,
            message: 'Ticket categories retrieved successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error fetching ticket categories');
        return throwError(res, 'Failed to retrieve ticket categories', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const getTicketCategoryById = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'getTicketCategoryById', params: req.params });

    try {
        const isValidId = mongoose.Types.ObjectId.isValid(req.params.id);

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: `Invalid Record Id: ${req.params.id}`
            });
        }

        const ticketCategory = await TicketCategory.findById(req.params.id);
        if (!ticketCategory) {
            return throwError(res, 'Ticket category not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: ticketCategory,
            message: 'Ticket category retrieved successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error fetching ticket category by ID');
        return throwError(res, 'Failed to retrieve ticket category', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const createTicketCategory = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'createTicketCategory', body: req.body });

    try {
        let iconData;

        if (req.file && !['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'].includes(req.file.mimetype)) {
            return throwError(res, 'Unsupported file type', HTTP_STATUS_CODE.BAD_REQUEST);
        }

        if (req.file) {
            const cloudinaryResult = await saveFileToCloud(req.file);
            iconData = cloudinaryResult;
        }


        const ticketCategory = await TicketCategory.createWithValidation({
            ...req.body,
            icon: iconData
        });

        res.status(HTTP_STATUS_CODE.CREATED).json({
            success: true,
            data: ticketCategory,
            message: 'Ticket category created successfully'
        });
    } catch (error: any) {
        log.error({ err: error }, 'Error creating ticket category');
        return throwError(
            res,
            error.message || 'Failed to create ticket category',
            HTTP_STATUS_CODE.BAD_REQUEST
        );
    }
};

export const updateTicketCategory = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'updateTicketCategory',
        params: req.params,
        body: req.body
    });

    try {
        const { name, color, bgColor, removeIcon } = req.body;
        const isValidId = mongoose.Types.ObjectId.isValid(req.params.id);

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: `Invalid Record Id: ${req.params.id}`
            });
        }

        // Check for duplicate name
        if (name) {
            const existing = await TicketCategory.findOne({
                _id: { $ne: req.params.id },
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
            });

            if (existing) {
                return throwError(
                    res,
                    'A ticket category with this name already exists',
                    HTTP_STATUS_CODE.BAD_REQUEST
                );
            }
        }

        // Fetch current ticket category
        const existingCategory = await TicketCategory.findById(req.params.id);
        if (!existingCategory) {
            return throwError(res, 'Ticket category not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        let updateData: any = { name, color, bgColor, isActive: req.body.isActive };

        // Handle icon removal or update
        if (removeIcon === 'true') {
            // Delete existing icon from Cloudinary if present
            if (existingCategory.icon?.imageId) {
                try {
                    await deleteFromCloudinary(existingCategory.icon.imageId);
                } catch (err) {
                    log.warn({ err }, 'Failed to delete old icon from Cloudinary');
                }
            }
            updateData.icon = null; // Remove the icon
        }
        else if (req.file) {
            // Delete existing icon from Cloudinary if present
            if (existingCategory.icon?.imageId) {
                try {
                    await deleteFromCloudinary(existingCategory.icon.imageId);
                } catch (err) {
                    log.warn({ err }, 'Failed to delete old icon from Cloudinary');
                    // Continue with new upload even if deletion fails
                    // (Cloudinary may auto-clean orphaned images)
                }
            }

            const cloudinaryResult = await saveFileToCloud(req.file);
            updateData.icon = cloudinaryResult;
        }

        const updatedTicketCategory = await TicketCategory.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedTicketCategory) {
            return throwError(res, 'Ticket category not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: updatedTicketCategory,
            message: 'Ticket category updated successfully'
        });
    } catch (error: any) {
        log.error({ err: error }, 'Error updating ticket category');
        return throwError(
            res,
            error.message || 'Failed to update ticket category',
            HTTP_STATUS_CODE.BAD_REQUEST
        );
    }
};


export const deleteTicketCategory = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'deleteTicketCategory', params: req.params });

    try {
        const isValidId = mongoose.Types.ObjectId.isValid(req.params.id);

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: `Invalid Record Id: ${req.params.id}`
            });
        }

        // Get the category first to access the Cloudinary imageId
        const category = await TicketCategory.findById(req.params.id);
        if (!category) {
            return throwError(res, 'Ticket category not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        // Try to delete image from Cloudinary but don't block the flow
        if (category?.icon?.imageId) {
            deleteFromCloudinary(category.icon.imageId).catch((error) => {
                log.warn({ err: error }, `Failed to delete Cloudinary image: ${category?.icon?.imageId}`);
            });
        }

        // Proceed to delete from DB regardless of Cloudinary result
        await TicketCategory.findByIdAndDelete(req.params.id);

        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            message: 'Ticket category deleted successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error deleting ticket category');
        return throwError(res, 'Failed to delete ticket category', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};
