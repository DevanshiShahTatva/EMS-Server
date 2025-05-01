import { Request, Response } from 'express';
import Contact from '../models/contact.model';
import { appLogger } from '../helper/logger';
import { sendContactConfirmationEmail, sendContactNotificationToAdmin } from '../helper/nodemailer';
import { ApiResponse, throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';

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

export const deleteContactById = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'deleteContactById',
        contactId: req.params.id
    });

    try {
        const rcResponse = new ApiResponse();
        const contactId = req.params.id;

        const contact = await Contact.findByIdAndDelete(contactId);

        if (!contact) {
            // log.warn(`Contact not found with ID: ${contactId}`);
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: 'Contact not found',
            });
        }

        // log.info(`Successfully deleted contact with ID: ${contactId}`);
        rcResponse.data = contact;
        rcResponse.message = 'Contact deleted successfully';

        return res.status(rcResponse.status).json(rcResponse);
    } catch (error) {
        log.error({ err: error }, 'Error deleting contact by ID');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', 400);
    }
};

export const deleteAllContacts = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'deleteAllContacts' });

    try {
        const rcResponse = new ApiResponse();

        const result = await Contact.deleteMany({});

        // log.info(`Deleted ${result.deletedCount} contacts`);
        rcResponse.data = { deletedCount: result.deletedCount };
        rcResponse.message = `Successfully deleted ${result.deletedCount} contacts`;

        return res.status(rcResponse.status).json(rcResponse);
    } catch (error) {
        log.error({ err: error }, 'Error deleting all contacts');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', 400);
    }
};