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
    const room = `private_${chatId}`;
    socket.join(room);

    const recentMessages: any = await PrivateMessage.find({ privateChat: chatId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender', 'name profileimage')
      .lean();

    socket.emit('initial_private_messages', {
      messages: recentMessages.reverse()
    });
  }

  const privateMessageHandler = async ({ chatId, content }: { chatId: string, content: string }) => {
    if (!socket.userId || !content.trim()) {
      socket.emit('error', 'Invalid message data');
      return;
    }

    try {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const privateChat = await PrivateChat.findOne({ _id: chatId })
          .session(session);

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

        let savedMessage = await message.save({ session });
        savedMessage = await savedMessage.populate('sender', 'name profileimage.url');

        const updateData: any = {
          lastMessage: savedMessage._id,
          updatedAt: new Date(),
          hasMessages: true
        };

        await PrivateChat.findByIdAndUpdate(chatId,
          updateData,
          { session }
        );

        await session.commitTransaction();

        const room = `private_${chatId}`;
        io.to(room).emit('receive_private_message', savedMessage);

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      console.error('Err:', error);
      socket.emit('error', 'Failed to send message');
    }
  }

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

  socket.on('join_private_chat', joinPersonalChat);
  socket.on('new_private_message', privateMessageHandler);
  socket.on('user_typing', typingMessage);
  socket.on('user_stopped_typing', stopTypingMessage);
  socket.on('edit_or_delete_private_message', editOrDeleteMessage);
}