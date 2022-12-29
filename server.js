const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
const corsOptionsDelegate = function (req, callback) {
  let corsOptions;
  if (allowlist.indexOf(req.header("Origin")) !== -1) {
    corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response
  } else {
    corsOptions = { origin: false }; // disable CORS for this request
  }
  callback(null, corsOptions); // callback expects two parameters: error and options
};
app.use(cors(corsOptionsDelegate));
// Создание сервера
const server = require("http").createServer(app);
// Берём API socket.io
const io = require("socket.io")(server, {
  cors: {
    origin: "https://chat-vy0n.onrender.com/",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

const rooms = new Map();

app.get("/rooms/:id", (req, res) => {
  const roomId = req.params.id;
  const obj = rooms.has(roomId)
    ? {
        users: [...rooms.get(roomId).get("users").values()],
        messages: [...rooms.get(roomId).get("messages").values()],
      }
    : { users: [], messages: [] };
  res.json(obj);
});

app.post("/rooms", (req, res) => {
  const { roomId, userName } = req.body;
  if (!rooms.has(roomId)) {
    rooms.set(
      roomId,
      new Map([
        ["users", new Map()],
        ["messages", []],
      ])
    );
  }
  console.log(rooms);
  res.send(rooms);
});
console.log(rooms);
// Подключаем клиенты
io.on("connection", (socket) => {
  socket.on("ROOM:JOIN", ({ roomId, userName }) => {
    socket.join(roomId);
    rooms.get(roomId).get("users").set(socket.id, userName);
    const users = [...rooms.get(roomId).get("users").values()];
    console.log(users);
    socket.in(roomId).emit("ROOM:SET_USERS", users);
  });
  // Выводим в консоль 'connection'
  console.log("connection", socket.id);

  socket.on("ROOM:NEW_MESSAGE", ({ roomId, userName, text }) => {
    const obj = {
      userName,
      text,
    };
    rooms.get(roomId).get("messages").push(obj);

    socket.to(roomId).emit("ROOM:NEW_MESSAGE", obj);
  });

  // Отправляем всем кто подключился сообщение привет
  // io.emit("hello", "Привет");
  // Что делать при случае дисконнекта
  socket.on("disconnect", () => {
    rooms.forEach((value, roomId) => {
      if (value.get("users").delete(socket.id)) {
        const users = [...value.get("users").values()];
        socket.broadcast.to(roomId).emit("ROOM:SET_USERS", users);
      }
    });
    console.log("disconnected");
  });
});

// Назначаем порт для сервера
server.listen(9999, () => console.log(`Server running on port 9999`));
