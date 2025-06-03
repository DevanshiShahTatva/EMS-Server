import { Request, Response } from "express";
import { getUserIdFromToken, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import Message from "../models/message.model";
import PrivateChat from "../models/privateChat.model";

export const privateChatList = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    const messages = await PrivateChat.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
      .populate('receiver', 'name profileimage')
      .populate('sender', 'name profileimage')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, userId, data: messages });

  } catch (err) {
    console.log('Error', err);
    return throwError(
      res,
      "Failed to fetch list",
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
};

export const createPrivateChat = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    const { memberId } = req.body;
    let privateChat = await PrivateChat.findOne({
      $or: [
        { sender: userId, receiver: memberId },
        { sender: memberId, receiver: userId }
      ]
    });
    if (!privateChat) {
      privateChat = new PrivateChat({
        sender: userId,
        receiver: memberId,
      });
      await privateChat.save();
    }

    res.json({ success: true, userId, data: privateChat });

  } catch (err) {
    console.log('Error', err);
    return throwError(
      res,
      "Failed to fetch list",
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
};

export const getPrivateMessages = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);

    const messages = await Message.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('receiver', 'name profileimage')
      .lean();

    res.json({ success: true, userId, data: messages });

  } catch (err) {
    console.log('Error', err);
    return throwError(
      res,
      "Failed to fetch personal messages",
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
}