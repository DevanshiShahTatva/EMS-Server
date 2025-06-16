import { Server } from 'socket.io';
import mongoose from 'mongoose';
import GroupMessage from '../../models/groupMessage.model';
import GroupChat from '../../models/groupChat.model';
import { AuthenticatedSocket } from '.';

interface GroupMessageData {
  groupId: string;
  type: 'text' | 'image';
  content: string;
  imageId?: string;
}

interface IEditMessage {
  groupId: string;
  messageId: string;
  newContent: string;
  status: 'edited' | 'deleted';
};

export default function groupChatHandlers(io: Server, socket: AuthenticatedSocket) {

  const joinGroupChat = async ({ groupId }: { groupId: string }) => {
    if (!socket.userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      socket.emit('error', 'Invalid user or group ID');
      return;
    }

    try {
      const group = await GroupChat.findOne({
        _id: groupId,
        'members.user': socket.userId
      }, {
        members: 1,
        lastMessage: 1
      }).lean();

      if (!group) {
        socket.emit('error', 'Not a member of this group');
        return;
      }

      socket.activeGroupId = groupId;

      socket.join(groupId);

      await GroupChat.updateOne(
        { _id: groupId, 'members.user': socket.userId },
        {
          $set: {
            'members.$.unreadCount': 0
          }
        }
      );

      const recentMessages: any = await GroupMessage.find({ group: groupId })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('sender', 'name profileimage')
        .lean();

      socket.emit('initial_group_messages', {
        groupId,
        messages: recentMessages.reverse()
      });

    } catch (error) {
      console.error('Err:', error);
      socket.emit('error', 'Failed to join group chat');
    }
  };

  const leaveGroupChat = async ({ groupId }: { groupId: string }) => {
    try {
      if (!socket.userId || !mongoose.Types.ObjectId.isValid(groupId)) {
        throw new Error('Invalid user or group ID');
      }

      const systemMessage: any = new GroupMessage({
        group: groupId,
        isSystemMessage: true,
        systemMessageType: 'user_left',
        content: `${socket?.userName ?? 'User'} left`,
        systemMessageData: { userId: socket.userId },
      });
      await systemMessage.save();

      await GroupChat.findByIdAndUpdate(
        groupId,
        { $pull: { members: { user: socket.userId } } }
      );

      io.to(groupId).emit('group_member_removed', {
        groupId,
        removedMemberId: socket.userId,
      });

      io.to(groupId).emit('receive_group_message', { message: [systemMessage], isSystemMsg: true });

      socket.leave(groupId);

    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', 'Failed to leave group chat');
      return;
    }
  };

  const handleGroupMessage = async ({ groupId, type, content, imageId }: GroupMessageData) => {
    if (!socket.userId || !content) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const group: any = await GroupChat.findOne(
        { _id: groupId, 'members.user': socket.userId },
        { members: 1 },
        { session }
      ).lean();

      if (!group) {
        socket.emit('error', 'No longer a group member');
        return;
      }

      const message = new GroupMessage({
        sender: socket.userId,
        group: groupId,
        content: content,
        msgType: type || 'text',
        imageId: type === 'image' ? imageId : "",
      });

      let savedMessage = await message.save({ session });
      await savedMessage.populate('sender', 'name profileimage');

      const socketsInRoom = await io.in(groupId).fetchSockets();
      const connectedUserIds = socketsInRoom
        .filter(s => (s as any).activeGroupId === groupId)
        .map(s => (s as any).userId)
        .filter(Boolean);

      const bulkOps = group.members.map((member: any) => ({
        updateOne: {
          filter: { _id: groupId, 'members.user': member.user },
          update: {
            $set: {
              ...(member.user.toString() === socket.userId ? {
                'members.$.unreadCount': 0
              } : {})
            },
            ...(!connectedUserIds.includes(member.user.toString()) &&
              member.user.toString() !== socket.userId ? {
              $inc: { 'members.$.unreadCount': 1 }
            } : {})
          }
        }
      }));

      bulkOps.push({
        updateOne: {
          filter: { _id: groupId },
          update: { $set: { lastMessage: savedMessage._id } }
        }
      });

      await GroupChat.bulkWrite(bulkOps, { session });
      await session.commitTransaction();

      io.to(groupId).emit('receive_group_message', { message: savedMessage.toObject(), isSystemMsg: false });

      const updatedGroup: any = await GroupChat.findById(groupId)
        .select('members lastMessage')
        .populate({
          path: 'lastMessage',
          select: 'sender content status msgType imageId createdAt',
          populate: {
            path: 'sender',
            select: '_id name'
          }
        })
        .lean();

      savedMessage = await savedMessage.populate('group');
      savedMessage = await savedMessage.populate('group.event');

      updatedGroup?.members.forEach((member: any) => {
        if (member.user.toString() !== socket.userId) {
          io.to(member.user.toString()).emit('unread_update', {
            type: 'group',
            chatId: groupId,
            unreadCount: member.unreadCount,
            msgType: updatedGroup.lastMessage?.msgType ?? 'text',
            senderId: updatedGroup.lastMessage?.sender?._id ?? null,
            status: updatedGroup.lastMessage?.status ?? "",
            lastMessageSender: updatedGroup.lastMessage?.sender?.name ?? null,
            lastMessage: updatedGroup.lastMessage?.content ?? null,
            lastMessageTime: updatedGroup.lastMessage?.createdAt ?? null,
          });

          io.to(member.user.toString()).emit('chat_notification', savedMessage);
        }
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Err:', error);
      socket.emit('error', 'Failed to send message');
    } finally {
      session.endSession();
    }
  };

  const typingMessage = ({ groupId }: { groupId: string }) => {
    socket.to(groupId).emit('user_typing', {
      groupId,
      user: {
        id: socket.userId,
        name: socket.userName
      }
    });
  }

  const stopTypingMessage = ({ groupId }: { groupId: string }) => {
    socket.to(groupId).emit('user_stopped_typing', {
      groupId,
      user: {
        id: socket.userId,
        name: socket.userName
      }
    });
  }

  const editOrDeleteMessage = async ({ status, groupId, messageId, newContent }: IEditMessage) => {
    try {
      if (!socket.userId) {
        throw new Error('Invalid request');
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const updatedMessage = await GroupMessage.findOneAndUpdate(
          {
            _id: messageId,
            group: groupId,
            sender: socket.userId,
          },
          {
            status: status,
            content: newContent.trim(),
            imageId: status === 'deleted' ? "" : undefined,
            msgType: status === 'deleted' ? 'text' : undefined,
          },
          { new: true, session }
        );

        if (!updatedMessage) {
          throw new Error('Group message not found or edit not allowed');
        }

        const currentLastMessage = await GroupChat.findById(groupId)
          .select('lastMessage')
          .session(session);

        let isLastMessage = false
        if (currentLastMessage?.lastMessage?.toString() === messageId) {
          await GroupChat.findByIdAndUpdate(groupId,
            { lastMessage: updatedMessage._id },
            { session }
          );
          isLastMessage = true;
        }

        await session.commitTransaction();

        io.to(groupId).emit('new_edited_or_deleted_message', {
          status,
          groupId,
          messageId,
          newMessage: newContent,
          isLastMessage: isLastMessage,
          updatedTime: updatedMessage.createdAt,
        });

        socket.emit('message_edited_or_deleted_successfully', { status });

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Err:', error);
      socket.emit('error', 'Failed to edit message');
    }
  };

  const closeGroupChat = async () => {
    socket.activeGroupId = undefined;
  }

  socket.on('join_group_chat', joinGroupChat);
  socket.on('group_member_typing', typingMessage);
  socket.on('group_member_stop_typing', stopTypingMessage);
  socket.on('send_group_message', handleGroupMessage);
  socket.on('edit_or_delete_message', editOrDeleteMessage);
  socket.on('leave_group_chat', leaveGroupChat);
  socket.on('close_group_chat', closeGroupChat);
}