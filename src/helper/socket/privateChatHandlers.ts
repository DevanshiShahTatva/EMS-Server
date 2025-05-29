import { Server } from 'socket.io';
import { AuthenticatedSocket } from '.';

export default function privateChatHandlers(io: Server, socket: AuthenticatedSocket) {
  socket.on('join_private_chat', ({ senderId, receiverId }) => {
    const room = `private_${senderId}_${receiverId}`;
    socket.join(room);
    console.log(`Joined private room ${room}`);
  });

  socket.on('private_message', ({ senderId, receiverId, message }) => {
    const room = `private_${senderId}_${receiverId}`;
    io.to(room).emit('receive_private_message', {
      message,
      senderId: socket.userId,
      receiverId: receiverId,
      timestamp: Date.now(),
    });
  });
}