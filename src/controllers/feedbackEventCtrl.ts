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
import TicketBook from "../models/eventBooking.model";
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
      const existingFeedback = await Feedback.findOne({eventId,userId});
      if(existingFeedback){
        res.status(rcResponse.status).json({message:"Feedback already submitted for this event."})
        return;
      }
      //Checking if user has attended the event
      const attendedEvent = await TicketBook.findOne({event:eventId,user:userId,isAttended:true});
      if(!attendedEvent){
        res.status(rcResponse.status).json({message:"You can only give feedback after attending the event."})
        return;
      }
      const user = await User.findById(userId);
      const feedback = await Feedback.create({
        rating,
        description,
        eventId,
        userId,
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
        const feedbackResult = await Feedback.find({userId:userId}).populate({
          path:'eventId',
          select:'title images'
        }).populate({
          path:'userId',
          select:'name email profileimage'
        });
        if (!feedbackResult || feedbackResult.length === 0) {
        res.status(rcResponse.status).json({message:'No Feedbacks found.'})
        }
        const allUserFeedbacks = feedbackResult.map(fb=>({
          _id:fb._id,
          rating:fb.rating,
          description:fb.description,
          isEdited:fb.isEdited,
          createdAt:fb.createdAt,
          updatedAt:fb.updatedAt,
          event:fb.eventId ? {
            id:fb.eventId._id,
            title:fb.eventId.title,
            image: fb.eventId.images?.[0]?.url || null
          }:null,
          user:fb.userId ? {
            id:fb.userId._id,
            name:fb.userId.name,
            email:fb.userId.email,
            profileimage: fb.userId.profileimage?.url || null
          }:null
        }))
        rcResponse.data = allUserFeedbacks;
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
        const feedbackResult = await Feedback.find({eventId:eventId}).populate({
          path:'userId',
          select:'name email profileimage'
        })
        if (!feedbackResult || feedbackResult.length === 0) {
          res.status(rcResponse.status).json({ message: 'No feedbacks found.' })
          return
        }
        const totalFeedbacks = feedbackResult.length;
        const averageRating = Number(
          (feedbackResult.reduce((acc,curr)=>acc + curr.rating,0)/totalFeedbacks).toFixed(2)
        )
        const allFeedbacks = feedbackResult.map((fb)=>({
          _id:fb._id,
          rating:fb.rating,
          description:fb.description,
          isEdited:fb.isEdited,
          createdAt:fb.createdAt,
          updatedAt:fb.updatedAt,
          user:fb.userId ? {
            id:fb.userId._id,
            name:fb.userId.name,
            email:fb.userId.email,
            profileimage:fb.userId.profileimage?.url || null
          }:null,
          event:{
            id:event._id,
            title:event.title,
            image:event.images?.[0]?.url || null
          }
        }));
        rcResponse.data = {averageRating,totalFeedbacks,allFeedbacks};
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