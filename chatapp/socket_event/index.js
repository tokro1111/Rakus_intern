export default (io, socket) => {
  // room入室メッセージをクライアントに送信する
  socket.on('enterEvent', ({ roomId, userName, message, event_type }) => {
    socket.join(roomId);
    io.to(roomId).emit("enterEvent", { userName, message, event_type })
  });

  // 退室メッセージをクライアントに送信する
  socket.on("exitEvent", ({ roomId, userName, message, event_type }) => {
    socket.leave(roomId);
    io.to(roomId).emit("exitEvent", { userName, message, event_type })
  })

  // 投稿メッセージを送信する
  socket.on("publishEvent", ({ roomId, userName, message, date, event_type }) => {
    io.to(roomId).emit("publishEvent", {userName, message, date, event_type})
  })

  // 新たに入室した人に対して、自身の名前を送信
  socket.on("publishExistEvent", ({ roomId, message }) => {
    io.to(roomId).emit("publishExistEvent", message)
  })
}