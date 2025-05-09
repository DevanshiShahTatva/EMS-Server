import { Request, Response } from "express";
import {
  ApiResponse,
  getUserIdFromToken,
  throwError,
} from "../helper/common";
import Event from "../models/event.model";
import { FeedbackModel } from "../models/feedback.model";
import { Types } from "mongoose";
import User from "../models/signup.model";
export const feedbackEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const rcResponse = new ApiResponse();
      const { rating, description } = req.body
      const eventId = req.params.id;
      if (!rating) {
        res.status(rcResponse.status).json({ message: 'Rating is required.' })
        return
      }
      //Checking if event is available
      const event = await Event.findById(eventId)
      if (!event) {
        res.status(rcResponse.status).json({ message: 'Event not found.' })
        return
      }
      //Checking if user is available
      const userId = new Types.ObjectId(getUserIdFromToken(req));
      if(!userId){
        res.status(rcResponse.status).json({message:'User not found.'})
      }
      const user = await User.findById(userId);
      const name = user.name;
      const email = user.email;    
      const feedback = await FeedbackModel.create({
        name,
        email,
        rating,
        description,
        eventId,
        userId
      })
      rcResponse.data = {
        success:"success",
        message:"Feedback submitted successfully!",
        feedbackId:feedback._id
      }
      res.status(rcResponse.status).send(rcResponse);
    } catch (error) {
      return throwError(res);
    }
  }
  
export const getFeedbackByUserId = async (req: Request, res: Response) => {
    try {
        const rcResponse = new ApiResponse();
        const userId = new Types.ObjectId(getUserIdFromToken(req));
        if(!userId){
            res.status(rcResponse.status).json({message:'User not found.'})
        }
        const feedbackResult = await FeedbackModel.find({userId:userId})
        if (!feedbackResult || feedbackResult.length === 0) {
        return throwError(res, "No feedbacks found");
        }
        rcResponse.data = feedbackResult;
        return res.status(rcResponse.status).send(rcResponse);
    } catch (error) {
        return throwError(res);
    }
};
export const getFeedbackByEventId = async (req: Request, res: Response) => {
    try {
        const rcResponse = new ApiResponse();
        const userId = getUserIdFromToken(req);
        const eventId = req.params.id;
        const event = await Event.findById(eventId)
        if (!event) {
            res.status(rcResponse.status).json({ message: 'Event not found.' })
            return
        }
        const feedbackResult = await FeedbackModel.find({eventId:eventId})
        if (!feedbackResult || feedbackResult.length === 0) {
        return throwError(res, "No feedbacks found");
        }
        rcResponse.data = feedbackResult;
        return res.status(rcResponse.status).send(rcResponse);
    } catch (error) {
        return throwError(res);
    }
};