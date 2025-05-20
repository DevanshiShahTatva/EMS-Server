import { Request, Response } from 'express';
import Faq from '../models/faq.model';
import { appLogger } from '../helper/logger';
import { ApiResponse, throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';
import mongoose from 'mongoose';
import aiGeneratorService from '../services/ai-generator.service';

export const getFaqs = async (req: Request, res: Response) => {
    const log = appLogger.child({ method: 'getFaqs' });

    try {
        // log.info('Fetching FAQs');
        const faqs = await Faq.find().sort({ createdAt: -1 });
        // log.info(`Found ${faqs.length} FAQs`);

        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: faqs,
            message: 'FAQs fetched successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error fetching FAQs');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const getFaqById = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'getFaqById',
        id: req.params.id
    });

    try {
        // log.info('Fetching FAQ by ID');
        const faq = await Faq.findById(req.params.id);

        if (!faq) {
            // log.warn('FAQ not found');
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        // log.info('FAQ fetched successfully');
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: faq,
            message: 'FAQ fetched successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error fetching FAQ by ID');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const createFaq = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'createFaq',
        body: req.body
    });

    try {
        // Handle both single FAQ and array of FAQs
        const faqsData = Array.isArray(req.body) ? req.body : [req.body];
        
        // Validate all FAQs
        const invalidFaqs = faqsData.filter(faq => !faq.question || !faq.answer);
        if (invalidFaqs.length > 0) {
            // log.warn('Validation failed - question and answer are required for all FAQs');
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Question and answer are required for all FAQs',
                invalidItems: invalidFaqs
            });
        }

        // log.info(`Creating ${faqsData.length} FAQ(s)`);
        const createdFaqs = await Faq.insertMany(faqsData);

        res.status(HTTP_STATUS_CODE.CREATED).json({
            success: true,
            data: createdFaqs,
            message: `Successfully created ${createdFaqs.length} FAQ(s)`
        });
    } catch (error) {
        log.error({ err: error }, 'Error creating FAQ(s)');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const updateFaq = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'updateFaq',
        id: req.params.id,
        body: req.body
    });

    try {
        const { question, answer } = req.body;
        const { id } = req.params

        const isValidId = mongoose.Types.ObjectId.isValid(id)

        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: `Invalid Faq Id: ${id}`
            });
        }


        if (!question || !answer) {
            // log.warn('Validation failed - question and answer are required');
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: 'Question and answer are required'
            });
        }

        // log.info('Updating FAQ');
        const updatedFaq = await Faq.findByIdAndUpdate(
            req.params.id,
            { question, answer },
            { new: true }
        );

        if (!updatedFaq) {
            // log.warn('FAQ not found for update');
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        // log.info('FAQ updated successfully');
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            data: updatedFaq,
            message: 'FAQ updated successfully'
        });

    } catch (error) {
        log.error({ err: error }, 'Error updating FAQ');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const deleteFaq = async (req: Request, res: Response) => {
    const log = appLogger.child({
        method: 'deleteFaq',
        id: req.params.id
    });

    try {
        const faqId = req.params.id

        const isValidId = mongoose.Types.ObjectId.isValid(faqId)
        if (!isValidId) {
            return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: `Invalid Faq Id: ${faqId}`
            });
        }

        const deletedFaq = await Faq.findByIdAndDelete(faqId);

        if (!deletedFaq) {
            // log.warn('FAQ not found for deletion');
            return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: 'FAQ not found'
            });
        }

        // log.info('FAQ deleted successfully');
        res.status(HTTP_STATUS_CODE.OK).json({
            success: true,
            message: 'FAQ deleted successfully'
        });
    } catch (error) {
        log.error({ err: error }, 'Error deleting FAQ');
        return throwError(res, error instanceof Error ? error.message : 'Unknown error', HTTP_STATUS_CODE.BAD_REQUEST);
    }
};

export const generateFaqAnswer = async (req: Request, res: Response) => {
  try {

    const rcResponse = new ApiResponse();
    const body = req.body;

    const prompt = `Generate a short, clear answer for the following FAQ question in 1-2 sentences. Avoid unnecessary details and keep the tone professional yet friendly.\n\nQuestion: ${body.question}\nAnswer:`;

    const generatedText = await aiGeneratorService.generateText(prompt);

    rcResponse.data = generatedText;
    res.status(rcResponse.status).send(rcResponse);
  } catch (error) {
    console.error("Server-side error:", error);
    throwError(res, "Generation failed");
  }
};