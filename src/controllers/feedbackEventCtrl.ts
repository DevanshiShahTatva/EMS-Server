import { Request, Response } from "express";
import {
  ApiResponse,
  throwError,
} from "../helper/common";
import Event from "../models/event.model";
import { FeedbackModel } from "../models/feedback.model";
export const feedbackEvent = async (req: any, res: Response): Promise<void> => {
    try {
      const rcResponse = new ApiResponse();
      const { rating, description } = req.body
      const eventId = req.params.id;
      if (!rating || !description) {
        res.status(rcResponse.status).json({ message: 'Rating, Description are required.' })
        return
      }
      //Checking if event is available
      const event = await Event.findById(eventId)
      if (!event) {
        res.status(rcResponse.status).json({ message: 'Event not found.' })
        return
      }
      
      const name = req.user.name;
      const email = req.user.email;    
      const feedback = await FeedbackModel.create({
        name,
        email,
        rating,
        description,
        eventId,
      })
  
      res.status(rcResponse.status).json({
        message: 'Feedback submitted successfully.',
        feedbackId: feedback._id,
      })
    } catch (error) {
      return throwError(res);
    }
  }
  