import { Request, Response } from 'express';
import Contact from '../models/contact.model';
import { appLogger } from '../helper/logger';
import { sendContactConfirmationEmail, sendContactNotificationToAdmin } from '../helper/nodemailer';
import { ApiResponse, getUserIdFromToken, throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';
import mongoose from 'mongoose';
import aiGeneratorService from '../services/ai-generator.service';
import { sendNotification } from '../services/notificationService';
import User from '../models/signup.model';

export const submitContactForm = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'submitContactForm',
        // body: req.body
    });

    try {
        const userId = await getUserIdFromToken(req);
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

        // send notification to login user
        if (userId) {
            // send notification for submit feedback
            setImmediate(() => {
                sendNotification(userId, {
                    title: "Query Submitted",
                    body: `You have successfully submitted query.`,
                    data: {
                        type: "query"
                    }
                });
            });
        }

        // send notification for update email
        const findAdminUser = await User.findOne({ role: "admin" });
        if(findAdminUser) {
            setImmediate(() => {
            sendNotification(findAdminUser._id, {
                title: `Query Submitted`,
                body: `${name} have been successfully submitted query.`,
                data: {
                type: "admin_query"
                }
            });
            });
        };

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
        res.status(400).json({
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

export const updateContactStatus = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'updateContactStatus',
        params: req.params,
        body: req.body,
    });

    try {
        const rcResponse = new ApiResponse();
        const { id } = req.params;
        const { status } = req.body;

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Invalid contact ID format',
            });
        }

        // Validate status value
        const validStatuses = ['pending', 'responded', 'spam'];
        if (!validStatuses.includes(status)) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`,
            });
        }

        // Update status
        const updatedContact = await Contact.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedContact) {
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: 'Contact not found',
            });
        }

        rcResponse.success = true;
        rcResponse.message = 'Contact status updated successfully';
        rcResponse.data = updatedContact;

        return res.status(HTTP_STATUS_CODE.OK).json(rcResponse);
    } catch (error) {
        log.error({ err: error }, 'Error updating contact status');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', 400);
    }
};

export const generateContactUsQueryAnswer = async (req: Request, res: Response) => {
  try {

    const rcResponse = new ApiResponse();
    const body = req.body;

    const prompt = `Please generate a smart, professional reply or description that can be included in the body of an email, based on the following query/message from a user:
        Keep it under 100 words. Use markdown formatting with bold headings
        .
        "${body.query}"`;

    const generatedText = await aiGeneratorService.generateText(prompt);

    rcResponse.data = generatedText;
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.error("Server-side error:", error);
    throwError(res, "Generation failed");
  }
};
