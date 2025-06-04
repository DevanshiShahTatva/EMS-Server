import { Server } from 'socket.io';
import mongoose from 'mongoose';
import GroupMessage from '../../models/groupMessage.model';
import GroupChat from '../../models/groupChat.model';
import { AuthenticatedSocket } from '.';

interface GroupMessageData {
  groupId: string;
  content: string;
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
        members: socket.userId
      });

      if (!group) {
        socket.emit('error', 'Not a member of this group');
        return;
      }

      socket.join(groupId);

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

      const systemMessage = new GroupMessage({
        group: groupId,
        isSystemMessage: true,
        systemMessageType: 'user_left',
        content: `${socket?.userName ?? 'User'} left`,
        systemMessageData: { userId: socket.userId },
        readBy: [socket.userId],
      });
      await systemMessage.save();

      await GroupChat.findByIdAndUpdate(
        groupId,
        { $pull: { members: socket.userId } },
      );

      io.to(groupId).emit('group_member_removed', {
        groupId,
        removedMemberId: socket.userId,
      });

      io.to(groupId).emit('receive_group_message', systemMessage);

      socket.leave(groupId);

    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', 'Failed to leave group chat');
      return;
    }
  };

  const handleGroupMessage = async ({ groupId, content }: GroupMessageData) => {
    if (!socket.userId || !content.trim()) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    try {
      const group = await GroupChat.findOne({
        _id: groupId,
        members: socket.userId
      });

      if (!group) {
        socket.emit('error', 'No longer a group member');
        return;
      }

      const message = new GroupMessage({
        sender: socket.userId,
        group: groupId,
        content: content.trim(),
        readBy: [socket.userId]
      });

      let savedMessage = await message.save();
      savedMessage = await savedMessage.populate('sender', 'name profileimage');

      await GroupChat.findByIdAndUpdate(groupId, {
        lastMessage: savedMessage._id
      });

      io.to(groupId).emit('receive_group_message', savedMessage);

    } catch (error) {
      console.error('Err:', error);
      socket.emit('error', 'Failed to send message');
    }
  };

  const joinUserGroups = async () => {
    if (!socket.userId) return;

    try {
      const groups = await GroupChat.find({ members: socket.userId });
      groups.forEach(group => {
        socket.join(group._id.toString());
      });
    } catch (error) {
      console.error('Err:', error);
    }
  };

  const typingMessage = ({ groupId }: { groupId: string }) => {
    socket.to(groupId).emit('user_typing', {
      groupId,
      user: socket.userName,
    });
  }

  const stopTypingMessage = ({ groupId }: { groupId: string }) => {
    socket.to(groupId).emit('user_stopped_typing', {
      groupId,
      user: socket.userName,
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

  socket.on('join_group_chat', joinGroupChat);
  socket.on('group_member_typing', typingMessage);
  socket.on('group_member_stop_typing', stopTypingMessage);
  socket.on('send_group_message', handleGroupMessage);
  socket.on('edit_or_delete_message', editOrDeleteMessage);
  socket.on('leave_group_chat', leaveGroupChat);

  joinUserGroups();
}