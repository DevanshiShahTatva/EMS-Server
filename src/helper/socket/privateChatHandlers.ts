import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { AuthenticatedSocket } from '.';
import PrivateChat from '../../models/privateChat.model';
import PrivateMessage from '../../models/privateMessage.model';

interface IEditMessage {
  chatId: string;
  messageId: string;
  newContent: string;
  status: 'edited' | 'deleted';
};

export default function privateChatHandlers(io: Server, socket: AuthenticatedSocket) {

  const joinPersonalChat = async ({ chatId }: { chatId: string }) => {
    if (!socket.userId || !mongoose.Types.ObjectId.isValid(chatId)) {
      socket.emit('error', 'Invalid user or chat Id');
      return;
    }

    try {

      const [chat, recentMessages]: any = await Promise.all([
        PrivateChat.findOne({ _id: chatId }).lean(),

        PrivateMessage.find({ privateChat: chatId })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('sender', 'name profileimage.url')
          .lean()
      ]);

      if (!chat) {
        return socket.emit('error', 'Chat not found or access denied');
      }

      const updateField = chat.sender.toString() === socket.userId
        ? { senderUnreadCount: 0 }
        : { receiverUnreadCount: 0 };

      await PrivateChat.updateOne({ _id: chatId }, { $set: updateField });

      const room = `private_${chatId}`;
      socket.join(room);

      socket.activeChatId = chatId;

      socket.emit('initial_private_messages', {
        messages: recentMessages.reverse()
      });

    } catch (error) {
      console.error('Error joining private chat:', error);
      socket.emit('error', 'Failed to join private chat');
    }
  };

  const privateMessageHandler = async ({ chatId, content }: { chatId: string, content: string }) => {
    if (!socket.userId || !content.trim()) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = new mongoose.Types.ObjectId(socket.userId);

      const privateChat = await PrivateChat.findOne(
        { _id: chatId },
        { sender: 1, receiver: 1 },
        { session }
      );

      if (!privateChat) {
        throw new Error('Private chat not found');
      }

      const isParticipant = [privateChat.sender, privateChat.receiver]
        .some(id => id.toString() === socket.userId);

      if (!isParticipant) {
        throw new Error('Not authorized to send message in this chat');
      }

      const message = new PrivateMessage({
        sender: socket.userId,
        privateChat: chatId,
        content: content.trim(),
        readBy: [socket.userId]
      });

      const savedMessage = await message.save({ session });
      await savedMessage.populate('sender', 'name profileimage.url');

      const room = `private_${chatId}`;
      const socketsInRoom = Array.from(await io.in(room).fetchSockets());
      const connectedUserId = socketsInRoom
        .filter(s => (s as any).activeChatId === chatId)
        .map(s => (s as any).userId)
        .filter(Boolean);

      const isSender = privateChat.sender.equals(userId);
      const otherUserId = isSender ? privateChat.receiver : privateChat.sender;
      const otherUserConnected = connectedUserId.includes(otherUserId.toString());

      const updateOperation = {
        $set: {
          lastMessage: savedMessage._id,
          hasMessages: true,
          [isSender ? 'senderUnreadCount' : 'receiverUnreadCount']: 0
        },
        ...(!otherUserConnected && {
          $inc: { [isSender ? 'receiverUnreadCount' : 'senderUnreadCount']: 1 }
        })
      };

      await Promise.all([
        PrivateChat.updateOne({ _id: chatId }, updateOperation, { session }),
        io.to(room).emit('receive_private_message', savedMessage),
        ...(otherUserConnected ? [] : [
          io.to(otherUserId.toString()).emit('chat_notification', savedMessage)
        ])
      ]);

      await session.commitTransaction();

      const updatedChat: any = await PrivateChat.findById({ _id: chatId })
        .select('senderUnreadCount receiverUnreadCount lastMessage')
        .populate({
          path: 'lastMessage',
          select: 'sender content status createdAt',
          populate: { path: 'sender', select: '_id name' }
        })
        .lean();

      io.to(otherUserId.toString()).emit('unread_update', {
        type: 'private',
        chatId,
        senderId: updatedChat.lastMessage?.sender?._id ?? null,
        status: updatedChat.lastMessage?.status ?? "",
        lastMessageSender: updatedChat.lastMessage?.sender?.name ?? null,
        lastMessage: updatedChat.lastMessage?.content ?? null,
        lastMessageTime: updatedChat.lastMessage?.createdAt ?? null,
        unreadCount: isSender ? updatedChat.receiverUnreadCount : updatedChat.senderUnreadCount,
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Err:', error);
      socket.emit('error', 'Failed to send message');
    } finally {
      session.endSession();
    }
  };

  const typingMessage = ({ chatId }: { chatId: string }) => {
    const room = `private_${chatId}`;
    socket.to(room).emit('private_user_typing', {
      chatId,
      user: {
        _id: socket.userId,
        name: socket.userName
      }
    });
  }

  const stopTypingMessage = ({ chatId }: { chatId: string }) => {
    const room = `private_${chatId}`;
    socket.to(room).emit('private_user_stopped_typing', {
      chatId,
      user: {
        _id: socket.userId,
        name: socket.userName
      }
    });
  }

  const editOrDeleteMessage = async ({ status, chatId, messageId, newContent }: IEditMessage) => {
    try {
      if (!socket.userId) {
        throw new Error('Invalid request');
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const updatedMessage = await PrivateMessage.findOneAndUpdate(
          {
            _id: messageId,
            privateChat: chatId,
            sender: socket.userId,
          },
          {
            status: status,
            content: newContent.trim(),
          },
          { new: true, session }
        );

        if (!updatedMessage) {
          throw new Error('Message not found or edit not allowed');
        }

        const currentLastMessage = await PrivateChat.findById(chatId)
          .select('lastMessage')
          .session(session);

        let isLastMessage = false
        if (currentLastMessage?.lastMessage?.toString() === messageId) {
          await PrivateChat.findByIdAndUpdate(chatId,
            { lastMessage: updatedMessage._id },
            { session }
          );
          isLastMessage = true;
        }

        await session.commitTransaction();

        const room = `private_${chatId}`;
        io.to(room).emit('new_edited_or_deleted_private_message', {
          status,
          chatId,
          messageId,
          newMessage: newContent,
          isLastMessage: isLastMessage,
          updatedTime: updatedMessage.createdAt,
        });

        socket.emit('private_message_edited_or_deleted_successfully', { status });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error:', error);
      socket.emit('error', 'Failed to edit message');
    }
  }

  const closePrivateChat = async () => {
    socket.activeChatId = undefined;
  }

  socket.on('join_private_chat', joinPersonalChat);
  socket.on('new_private_message', privateMessageHandler);
  socket.on('user_typing', typingMessage);
  socket.on('user_stopped_typing', stopTypingMessage);
  socket.on('edit_or_delete_private_message', editOrDeleteMessage);
  socket.on('close_private_chat', closePrivateChat);
}