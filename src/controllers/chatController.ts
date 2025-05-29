import { Request, Response } from "express";
import mongoose from 'mongoose';
import { getUserIdFromToken, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import GroupChat from "../models/groupChat.model";
import Message from "../models/message.model";

export const groupChatList = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    const groups = await GroupChat.find({ members: userId })
      .populate('event', 'images')
      .lean();

    const groupDataWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        const lastMessage: any = await Message.findOne({ groupId: group._id })
          .sort({ createdAt: -1 })
          .select('content createdAt')
          .lean();

        return {
          id: group._id,
          name: group.name,
          icon: group.event?.images?.[0]?.url ?? '',
          senderId: lastMessage?.sender?._id ?? null,
          lastMessage: lastMessage?.content ?? null,
          lastMessageTime: lastMessage?.createdAt ?? null,
        };
      })
    );

    res.json({ success: true, userId, data: groupDataWithLastMessage });
  } catch (err) {
    console.log('Error', err);
    return throwError(
      res,
      "Failed to fetch list",
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
};

export const getGroupMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId } = req.params;
    const userId = getUserIdFromToken(req);
    const { limit = 50, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      res.status(400).json({ error: 'Invalid group ID' });
      return;
    }

    const isMember = await GroupChat.exists({
      _id: groupId,
      members: userId
    });

    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const query: any = { group: groupId };
    if (before && !isNaN(Date.parse(before as string))) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'username avatar')
      .lean();

    const sortedMessages = messages.reverse();

    res.status(200).json({
      success: true,
      data: sortedMessages,
      hasMore: messages.length === Number(limit)
    });

  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};