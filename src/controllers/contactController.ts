import { Request, Response } from 'express';
import Contact from '../models/contact.model';
import { appLogger } from '../helper/logger';
import { sendContactConfirmationEmail, sendContactNotificationToAdmin } from '../helper/nodemailer';
import { ApiResponse, throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';
import mongoose from 'mongoose';

export const submitContactForm = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'submitContactForm',
        // body: req.body
    });

    try {
        const { name, email, subject, message } = req.body;

        // log.info('Creating new contact');
        const contact = await Contact.create({
            name,
            email,
            subject,
            message,
        });

        if (process.env.SEND_EMAILS === 'true') {
            // log.info('Sending contact emails');

            // 1. Send confirmation to user
            await sendContactConfirmationEmail(email, name, subject);

            // 2. Send notification to admin
            await sendContactNotificationToAdmin(email, name, subject, message);
        }

        // log.info('Contact form submitted successfully');
        res.status(201).json({
            success: true,
            data: contact,
            message: 'Thank you for contacting us. We will get back to you soon.',
        });

    } catch (error) {
        log.error({ err: error }, 'Error submitting contact form');
        res.status(400).json({
            success: false,
            message: 'Error submitting contact form',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const getContacts = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'getContacts' });

    try {
        // log.info('Fetching contacts');
        const contacts = await Contact.find().sort({ createdAt: -1 });
        // log.info(`Found ${contacts.length} contacts`);
        res.status(200).json({ success: true, data: contacts });
    } catch (error) {
        log.error({ err: error }, 'Error fetching contacts');
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const deleteContacts = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'deleteContacts',
        body: req.body
    });

    try {
        const rcResponse = new ApiResponse();
        const { ids } = req.body;

        // Validate input exists
        if (!ids) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Please provide "ids" array in request body',
            });
        }

        // Normalize to array
        const idArray = Array.isArray(ids) ? ids : [ids];

        if (idArray.length === 0) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'The "ids" array cannot be empty',
            });
        }

        // Separate valid and invalid format IDs
        const validFormatIds = idArray.filter(id => mongoose.Types.ObjectId.isValid(id));
        const invalidFormatIds = idArray.filter(id => !mongoose.Types.ObjectId.isValid(id));

        // Find which valid IDs actually exist in DB
        const existingContacts = await Contact.find({ _id: { $in: validFormatIds } }).select('_id');
        const existingIds = existingContacts.map(c => c._id.toString());
        const nonExistingIds = validFormatIds.filter(id => !existingIds.includes(id));

        // Combine all invalid cases (format + non-existing)
        const allInvalidIds = [...invalidFormatIds, ...nonExistingIds];

        // Perform deletion on existing contacts
        await Contact.deleteMany({ _id: { $in: existingIds } });

        rcResponse.data = {
            deletedIds: existingIds,
            invalidIds: allInvalidIds.length > 0 ? allInvalidIds : undefined
        };
        if(allInvalidIds.length){
            rcResponse.success = false
        }

        // Build informative message
        let messageParts = [];
        if (existingIds.length > 0) messageParts.push(`Deleted ${existingIds.length} contact(s)`);
        if (allInvalidIds.length > 0) messageParts.push(`${allInvalidIds.length} invalid ID(s)`);
        
        rcResponse.message = messageParts.join(', ') || 'No actions taken';

        return res.status(rcResponse.status).json(rcResponse);
    } catch (error) {
        log.error({ err: error }, 'Error deleting contact(s)');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', 400);
    }
};