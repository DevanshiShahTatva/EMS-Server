import { Request, Response } from "express";
import {
  ApiResponse,
  deleteOne,
  findOne,
  getUserIdFromToken,
  throwError,
  updateOne,
} from "../helper/common";
import Event from "../models/event.model";
import Feedback  from "../models/feedback.model";
import { Types } from "mongoose";
import User from "../models/signup.model";
import { HTTP_STATUS_CODE } from "../utilits/enum";
export const feedbackEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const rcResponse = new ApiResponse();
      const { rating, description } = req.body
      const eventId = req.params.id;
      if (!rating) {
        res.status(rcResponse.status).json({ message: 'Rating is required.' })
        return
      }
      console.log("Getting event",eventId);
      //Checking if event is available
      const event = await Event.findById(eventId)
      if (!event) {
        res.status(rcResponse.status).json({ message: 'Event not found.' })
        return
      }
      console.log("Getting event",event);
      //Checking if user is available
      const userId = new Types.ObjectId(getUserIdFromToken(req));
      console.log("Getting event",userId);
      if(!userId){
        res.status(rcResponse.status).json({message:'User not found.'})
      }
      const user = await User.findById(userId);
      console.log("Getting user",user);
      const name = user.name;
      const email = user.email;    
      const profileimage = user.profileimage ? user.profileimage.url : null;
      console.log("This is feedback incoming", name,rating);
      const feedback = await Feedback.create({
        name,
        email,
        rating,
        description,
        eventId,
        userId,
        profileimage
      })
      console.log("Feedback is",feedback);
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
        const feedbackResult = await Feedback.find({userId:userId})
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
        const feedbackResult = await Feedback.find({eventId:eventId})
        if (!feedbackResult || feedbackResult.length === 0) {
        return throwError(res, "No feedbacks found");
        }
        rcResponse.data = feedbackResult;
        console.log("feedbacks",feedbackResult);
        return res.status(rcResponse.status).send(rcResponse);
    } catch (error) {
        return throwError(res);
    }
};

export const deleteFeedback = async (req:Request,res:Response)=>{
  try{
    const rcResponse = new ApiResponse();
    const feedbackId = req.params.id;
    let sort = {created:-1};
    const feedback = await findOne("Feedback",{_id:feedbackId},sort);
    if(!feedback){
      return throwError(res,"Feedback not found",HTTP_STATUS_CODE.NOT_FOUND);
    }
    rcResponse.data = await deleteOne("Feedback",{_id:feedbackId});
    rcResponse.message = "Feedback deleted Successfully";
    return res.status(rcResponse.status).send(rcResponse);
  }catch(error){
    return throwError(res);
  }
}

export const editFeedback = async(req:Request,res:Response)=>{
  try{
    const rcResponse = new ApiResponse();
    const feedbackId = req.params.id;
    const findEvent = await findOne("Feedback",{_id:feedbackId});
    if(!findEvent){
      return throwError(res,"Feedback not found",HTTP_STATUS_CODE.NOT_FOUND);
    }
    const updatedFeedback = {
      ...req.body,
      isEdited:true
    };
    const result = await updateOne("Feedback", { _id: feedbackId }, updatedFeedback);
    rcResponse.data = result;
    rcResponse.message = "Feedback updated successfully.";
    return res.status(rcResponse.status).send(rcResponse);
  } catch (error){
    return throwError(res);
  }
}