import { Request, Response } from "express";
import mongoose from 'mongoose';
import { getUserIdFromToken, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import GroupChat from "../models/groupChat.model";
import Message from "../models/groupMessage.model";

export const groupChatList = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    const groups = await GroupChat.aggregate([
      { $match: { members: new mongoose.Types.ObjectId(userId) } },
      { $sort: { updatedAt: -1 } },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'event',
          pipeline: [{ $project: { title: 1, 'images.url': 1 } }]
        }
      },
      { $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'groupmessages',
          localField: 'lastMessage',
          foreignField: '_id',
          as: 'lastMessage',
          pipeline: [
            { $limit: 1 },
            {
              $lookup: {
                from: 'users',
                localField: 'sender',
                foreignField: '_id',
                as: 'sender',
                pipeline: [{ $project: { name: 1 } }]
              }
            },
            { $unwind: '$sender' }
          ]
        }
      },
      { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'members',
          foreignField: '_id',
          as: 'members',
          pipeline: [{ $project: { name: 1, 'profileimage.url': 1 } }]
        }
      }
    ]);

    const groupData = groups.map((group) => ({
      id: group._id,
      name: group.event?.title ?? "",
      members: group.members.map((member: any) => ({
        id: member._id,
        name: member.name ?? "",
        avatar: member.profileimage?.url ?? null
      })),
      icon: group.event?.images?.[0]?.url ?? null,
      senderId: group.lastMessage?.sender?._id ?? null,
      status: group.lastMessage?.status ?? "",
      lastMessageSender: group.lastMessage?.sender?.name ?? null,
      lastMessage: group.lastMessage?.content ?? null,
      lastMessageTime: group.lastMessage?.createdAt ?? null,
    }));

    res.json({ success: true, userId, data: groupData });
  } catch (err) {
    console.log('Err', err);
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
    console.error('Err:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};