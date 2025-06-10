import { Request, Response } from "express";
import mongoose from "mongoose";
import { getUserIdFromToken, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import PrivateChat from "../models/privateChat.model";
import PrivateMessage from "../models/privateMessage.model";

export const privateChatList = async (req: Request, res: Response) => {
  try {
    const currentUserId = getUserIdFromToken(req);
    const userId = new mongoose.Types.ObjectId(currentUserId);

    const privateChats = await PrivateChat.aggregate([
      {
        $match: {
          $or: [
            { sender: userId, senderVisible: true },
            {
              receiver: userId,
              $or: [
                { receiverVisible: true },
                { hasMessages: true }
              ]
            }
          ]
        }
      },
      { $sort: { updatedAt: -1 } },
      {
        $addFields: {
          userRole: {
            $cond: [
              { $eq: ["$sender", userId] },
              "sender",
              "receiver"
            ]
          }
        }
      },
      {
        $lookup: {
          from: "privatemessages",
          localField: "lastMessage",
          foreignField: "_id",
          as: "lastMessage",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "sender",
                pipeline: [{ $project: { name: 1 } }]
              }
            },
            { $unwind: "$sender" },
            { $project: { content: 1, createdAt: 1, sender: 1 } }
          ]
        }
      },
      { $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "sender",
          foreignField: "_id",
          as: "senderInfo",
          pipeline: [{ $project: { name: 1, "profileimage.url": 1 } }]
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "receiver",
          foreignField: "_id",
          as: "receiverInfo",
          pipeline: [{ $project: { name: 1, "profileimage.url": 1 } }]
        }
      },
      { $unwind: "$senderInfo" },
      { $unwind: "$receiverInfo" },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          userRole: 1,
          participant: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiverInfo",
              "$senderInfo"
            ]
          },
          unreadCount: {
            $cond: [
              { $eq: ["$userRole", "sender"] },
              "$senderUnreadCount",
              "$receiverUnreadCount"
            ]
          }
        }
      }
    ]);

    const chats = privateChats.map((chat) => ({
      id: chat._id,
      name: chat.participant.name,
      image: chat.participant.profileimage?.url ?? null,
      unreadCount: chat.unreadCount ?? 0,
      senderId: chat.lastMessage?.sender?._id ?? null,
      status: chat.lastMessage?.status ?? "",
      lastMessage: chat.lastMessage?.content ?? null,
      lastMessageSender: chat.lastMessage?.sender?.name ?? null,
      lastMessageTime: chat.lastMessage?.createdAt ?? null,
    }));

    res.json({ success: true, userId, data: chats });

  } catch (err) {
    console.log('Err', err);
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

    if (!userId || !memberId) {
      return throwError(res, "User ID and Member ID are required", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    if (userId.toString() === memberId.toString()) {
      return throwError(res, "You cannot create a chat with yourself", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return throwError(res, "Invalid User ID or Member ID", HTTP_STATUS_CODE.BAD_REQUEST);
    }

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
        senderVisible: true,
        receiverVisible: false,
        senderUnreadCount: 0,
        receiverUnreadCount: 0,
        hasMessages: false
      });
    } else {
      const isSender = privateChat.sender._id.toString() === userId.toString();

      if (isSender) {
        privateChat.senderVisible = true;
      } else {
        privateChat.receiverVisible = true;
      }
    }

    await privateChat.save();

    await privateChat.populate([
      {
        path: "sender",
        select: "name profileimage.url"
      },
      {
        path: "receiver",
        select: "name profileimage.url"
      }
    ]);

    const isSender = privateChat.sender._id.toString() === userId.toString();
    const participant = isSender ? privateChat.receiver : privateChat.sender;

    const newChat = {
      id: privateChat._id,
      name: participant.name,
      image: participant.profileimage?.url ?? null,
      status: "",
      senderId: null,
      lastMessage: null,
      lastMessageSender: null,
      lastMessageTime: null,
    }

    res.json({ success: true, userId, chat: newChat });

  } catch (err) {
    console.log('Err', err);
    return throwError(
      res,
      "Failed to create chat",
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
};

export const getPrivateMessages = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = getUserIdFromToken(req);
    const { limit = 20, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      res.status(400).json({ error: 'Invalid Chat ID' });
      return;
    }

    const isMember = await PrivateChat.exists({
      _id: chatId,
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    });

    if (!isMember) {
      res.status(403).json({ error: 'You are not a member of this chat' });
      return;
    }

    const query: any = { privateChat: chatId };
    if (before && !isNaN(Date.parse(before as string))) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages: any = await PrivateMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'name profileimage')
      .lean();

    res.status(200).json({
      success: true,
      data: messages.reverse(),
      hasMore: messages.length === Number(limit)
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};