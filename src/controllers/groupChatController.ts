import { Request, Response } from "express";
import mongoose from 'mongoose';
import { getUserIdFromToken, throwError } from "../helper/common";
import { HTTP_STATUS_CODE } from "../utilits/enum";
import GroupChat from "../models/groupChat.model";
import GroupMessage from "../models/groupMessage.model";
import User from "../models/signup.model";
import { io } from "../server";

export const groupChatList = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromToken(req);
    const objectIdUserId = new mongoose.Types.ObjectId(userId);

    const groups = await GroupChat.aggregate([
      { $match: { 'members.user': objectIdUserId } },
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
        $addFields: { originalMembers: '$members' }
      },
      {
        $lookup: {
          from: 'users',
          let: { userIds: '$originalMembers.user' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$userIds'] } } },
            { $project: { name: 1, 'profileimage.url': 1 } }
          ],
          as: 'userInfos'
        }
      },
      {
        $addFields: {
          members: {
            $map: {
              input: '$originalMembers',
              as: 'member',
              in: {
                $mergeObjects: [
                  '$$member',
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$userInfos',
                          as: 'u',
                          cond: { $eq: ['$$u._id', '$$member.user'] }
                        }
                      },
                      0
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          unreadCount: {
            $ifNull: [
              {
                $first: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$originalMembers',
                        as: 'm',
                        cond: { $eq: ['$$m.user', objectIdUserId] }
                      }
                    },
                    as: 'me',
                    in: '$$me.unreadCount'
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          event: 1,
          members: 1,
          lastMessage: 1,
          unreadCount: 1
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
      unreadCount: group.unreadCount,
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
      'members.user': userId
    });

    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const query: any = { group: groupId };
    if (before && !isNaN(Date.parse(before as string))) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages: any = await GroupMessage.find(query)
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

export const addMembersInGroup = async (req: Request, res: Response) => {
  try {
    const adminId = getUserIdFromToken(req);
    const { groupId } = req.params;
    const { members } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return throwError(res, "Invalid group ID", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    if (!Array.isArray(members) || members.length === 0) {
      return throwError(res, "Members array is required", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    const group: any = await GroupChat.findOne({
      _id: groupId,
      'members.user': adminId
    }).lean();

    if (!group) {
      return throwError(res, "You are not a member of this group", HTTP_STATUS_CODE.FORBIDDEN);
    }

    const existingMemberIds = group.members.map((m: { user: string }) => m.user.toString());

    const membersToAdd = members.filter(id =>
      !existingMemberIds.includes(id) && mongoose.Types.ObjectId.isValid(id)
    );

    if (membersToAdd.length === 0) {
      return throwError(res, "All users are already members!", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    const newMembersData = await User.find(
      { _id: { $in: membersToAdd } },
      'name profileimage'
    ).lean();

    await GroupChat.findOneAndUpdate(
      { _id: groupId },
      { $addToSet: { members: { $each: membersToAdd.map(id => ({ user: id, unreadCount: 0 })) } } },
      { new: true }
    );

    const systemMessages = newMembersData.map(user => ({
      group: groupId,
      isSystemMessage: true,
      systemMessageType: 'user_added',
      content: `Admin added ${user.name}`,
      systemMessageData: {
        adminId,
        userId: user._id
      },
      readBy: [adminId]
    }));

    await GroupMessage.insertMany(systemMessages);

    if (io) {
      io.to(groupId).emit('receive_group_message', { message: systemMessages, isSystemMsg: true });
      io.to(groupId).emit('group_member_added', {
        groupId,
        members: newMembersData.map(member => ({
          id: member._id,
          name: member?.name ?? "",
          avatar: member?.profileimage?.url ?? null
        }))
      });
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Err:', error);
    return throwError(res, "Failed to add members", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
};

export const removeMemberFromGroup = async (req: Request, res: Response) => {
  try {
    const adminId = getUserIdFromToken(req);
    const { groupId } = req.params;
    const { memberId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return throwError(res, "Invalid ID provided", HTTP_STATUS_CODE.BAD_REQUEST);
    }

    const group = await GroupChat.findOne({
      _id: groupId,
      'members.user': adminId
    }).populate("event", "title");

    if (!group) {
      return throwError(res, "You are not authorized to remove members", HTTP_STATUS_CODE.FORBIDDEN);
    }

    const memberExists = group.members.some((m: { user: string }) => m.user.toString() === memberId);
    if (!memberExists) {
      return throwError(res, "Member not found in group", HTTP_STATUS_CODE.NOT_FOUND);
    }

    const memberToRemove = await User.findById(memberId, 'name');
    if (!memberToRemove) {
      return throwError(res, "User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }

    await GroupChat.findByIdAndUpdate(
      groupId,
      { $pull: { members: { user: memberId } } },
      { new: true }
    );

    const systemMessage = new GroupMessage({
      group: groupId,
      isSystemMessage: true,
      systemMessageType: 'user_removed',
      content: `Admin removed ${memberToRemove.name}`,
      systemMessageData: {
        adminId,
        userId: memberToRemove._id
      },
      readBy: [adminId],
    });

    await systemMessage.save();

    if (io) {
      group.members.forEach((member: any) => {
        if (member.user.toString() !== adminId) {
          io.to(member.user.toString()).emit('group_member_removed', {
            groupId,
            removedMemberId: memberId,
            groupName: group.event?.title ?? "",
          });
        }
      });

      io.to(groupId).emit('receive_group_message', { message: [systemMessage], isSystemMsg: true });

      const memberSockets = await io.in(memberId).fetchSockets();
      memberSockets.forEach(socket => {
        socket.leave(groupId);
      });
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("Err:", err);
    return throwError(res, "Failed to remove member from group", HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR);
  }
};