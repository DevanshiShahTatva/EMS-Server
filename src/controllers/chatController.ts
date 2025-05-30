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
      .populate('event', 'title images')
      .populate({
        path: 'members',
        select: '_id name profileimage',
        model: 'User'
      })
      .populate({
        path: 'lastMessage',
        select: 'content createdAt',
        populate: {
          path: 'sender',
          select: 'name',
          model: 'User'
        }
      })
      .sort({ updatedAt: -1 })
      .lean();

    const groupDataWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        return {
          id: group._id,
          name: group.event?.title ?? "",
          members: await Promise.all(
            group.members.map((member: any) => ({
              id: member._id,
              name: member.name ?? "",
              avatar: member.profileimage?.url ?? null
            }))
          ),
          icon: group.event?.images?.[0]?.url ?? null,
          lastMessageSender: group.lastMessage?.sender.name ?? null,
          lastMessage: group.lastMessage?.content ?? null,
          lastMessageTime: group.lastMessage?.createdAt ?? null,
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

export const getGroupMessages = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = getUserIdFromToken(req);
    const { limit = 20, before } = req.query;

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

    const messages: any = await Message.find(query)
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