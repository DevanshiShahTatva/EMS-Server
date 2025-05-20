import { Request, Response } from 'express';
import Terms from '../models/terms.model';
import { appLogger } from '../helper/logger';
import { throwError } from '../helper/common';
import { HTTP_STATUS_CODE } from '../utilits/enum';
import aiGeneratorService from '../services/ai-generator.service';
import { TERMS_GENERATION_PROMPT } from '../helper/prompts';

export const getTerms = async (req: Request, res: Response) => {
  const log = appLogger.child({ method: 'getTerms' });

  try {
    const terms = await Terms.getSingleton();
    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      data: terms,
      message: 'Terms retrieved successfully'
    });
  } catch (error) {
    log.error({ err: error }, 'Error fetching terms');
    return throwError(res, 'Failed to retrieve terms', HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
};

export const updateTerms = async (req: Request, res: Response) => {
  const log = appLogger.child({
    method: 'updateTerms',
    body: req.body
  });

  try {
    const { content } = req.body;

    if (!content) {
      // log.warn('Validation failed - content is required');
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Content is required'
      });
    }

    const terms = await Terms.getSingleton();
    terms.content = content;
    await terms.save();

    // log.info('Terms updated successfully');
    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      data: terms,
      message: 'Terms updated successfully'
    });
  } catch (error) {
    log.error({ err: error }, 'Error updating terms');
    return throwError(res, 'Failed to update terms', HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
};

export const resetTerms = async (req: Request, res: Response) => {
  const log = appLogger.child({ method: 'resetTerms' });

  try {
    await Terms.deleteMany({});
    // log.info('Terms reset successfully');
    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      message: 'Terms reset to initial state'
    });
  } catch (error) {
    log.error({ err: error }, 'Error resetting terms');
    return throwError(res, 'Failed to reset terms', HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
};

export const generateTerms = async (req: Request, res: any) => {
  const log = appLogger.child({ method: 'generateTerms' });

  try {
    const { keywords } = req.body;

    if (!(keywords as string[]).length) {
      // log.warn('Missing required fields');
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        success: false,
        message: 'Title, start time, end time, and location are required',
      });
    }
    const prompt = TERMS_GENERATION_PROMPT(keywords)

    const generatedText = await aiGeneratorService.generateText(prompt);

    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      data: generatedText,
      message: 'Terms generated successfully',
    });
  } catch (error) {
    log.error({ err: error }, 'Failed to generate terms');
    throwError(res, 'Failed to generate terms', HTTP_STATUS_CODE.BAD_REQUEST);
  }
};