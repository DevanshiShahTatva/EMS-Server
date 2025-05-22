import { Request, Response } from 'express';
import TicketType from '../models/ticketType.model';
import { appLogger } from '../helper/logger';
import { throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';
import mongoose from 'mongoose';
import Event from '../models/event.model';

export const getAllTicketTypes = async (_req: Request, res: Response) => {
    const log = appLogger.child({ method: 'getAllTicketTypes' });

    try {
        const ticketTypes = await TicketType.find().sort({ createdAt: -1 });
        const ticketTypesWithIsUsed = await Promise.all(ticketTypes.map(async (ticketType) => {
            const eventCount = await Event.countDocuments({ 'tickets.type': ticketType._id });
            return { ...ticketType.toObject(), isUsed: eventCount > 0 };
        }));
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: ticketTypesWithIsUsed,
            message: 'Ticket types retrieved successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error fetching ticket types');
        return throwError(res, 'Failed to retrieve ticket types', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const getTicketTypeById = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'getTicketTypeById', params: req.params });

    try {
        const isValidId = mongoose.Types.ObjectId.isValid(req.params.id)

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: `Invalid Record Id: ${req.params.id}`
            });
        }

        const ticketType = await TicketType.findById(req.params.id);
        if (!ticketType) {
            // log.warn('Ticket type not found');
            return throwError(res, 'Ticket type not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: ticketType,
            message: 'Ticket type retrieved successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error fetching ticket type by ID');
        return throwError(res, 'Failed to retrieve ticket type', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const createTicketType = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'createTicketType', body: req.body });

    try {
        const ticketType = await TicketType.createWithValidation(req.body);

        // log.info('Ticket type created successfully');
        res.status(HTTP_STATUS_CODE.CREATED).json({
            success: true,
            data: ticketType,
            message: 'Ticket type created successfully'
        });
    } catch (error: any) {
        log.error({ err: error }, 'Error creating ticket type');
        return throwError(
            res,
            error.message || 'Failed to create ticket type',
            HTTP_STATUS_CODE.BAD_REQUEST
        );
    }
};

export const updateTicketType = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'updateTicketType',
        params: req.params,
        body: req.body
    });

    try {
        const { name } = req.body;

        const isValidId = mongoose.Types.ObjectId.isValid(req.params.id)

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: `Invalid Record Id: ${req.params.id}`
            });
        }

        // Check for duplicate name
        if (name) {
            const existing = await TicketType.findOne({
                _id: { $ne: req.params.id },
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } // case-insensitive match
            });

            if (existing) {
                // log.warn('Duplicate ticket type name');
                return throwError(res, 'A ticket type with this name already exists', HTTP_STATUS_CODE.BAD_REQUEST);
            }
        }

        const updatedTicketType = await TicketType.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );


        if (!updatedTicketType) {
            // log.warn('Ticket type not found');
            return throwError(res, 'Ticket type not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        // log.info('Ticket type updated successfully');
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: updatedTicketType,
            message: 'Ticket type updated successfully'
        });
    } catch (error: any) {
        log.error({ err: error }, 'Error updating ticket type');
        return throwError(
            res,
            error.message || 'Failed to update ticket type',
            HTTP_STATUS_CODE.BAD_REQUEST
        );
    }
};

export const deleteTicketType = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'deleteTicketType', params: req.params });

    try {
        const isValidId = mongoose.Types.ObjectId.isValid(req.params.id)

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: `Invalid Record Id: ${req.params.id}`
            });
        }

        const eventUsingTicketTypeList = await Event.find({
            'tickets.type': req.params.id
        });

        if (eventUsingTicketTypeList.length > 0) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                data: eventUsingTicketTypeList,
                message: `Cannot delete ticket type as it is being used by one or more events"`
            });
        }

        const deleted = await TicketType.findByIdAndDelete(req.params.id);
        if (!deleted) {
            // log.warn('Ticket type not found');
            return throwError(res, 'Ticket type not found', HTTP_STATUS_CODE.NOT_FOUND);
        }

        // log.info('Ticket type deleted successfully');
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            message: 'Ticket type deleted successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error deleting ticket type');
        return throwError(res, 'Failed to delete ticket type', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};