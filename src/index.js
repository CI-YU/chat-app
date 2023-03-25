require('dotenv').config()
const path = require('path');
const http = require('http');
const { Configuration, OpenAIApi } = require("openai");
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {
  generateMessage,
  generateLocationMessage,
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {
  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);
    socket.emit('message', generateMessage('Admin', 'Welcome!'));
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        generateMessage('Admin', `${user.username} has joined!`)
      );
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on('sendMessage', async ({ inputValue, callType }, callback) => {
    const user = getUser(socket.id);

    const filter = new Filter();
    if (filter.isProfane(inputValue)) {
      return callback('Profanity is not allowed');
    }

    if (callType !== null) {
      let inputGPT = ``
      let input = ``
      switch (callType) {
        case "1":
          input = `文法檢查：[${inputValue}]`;
          inputGPT = `幫我檢查後方[]內的英文文法有沒有錯誤：[${inputValue}]`;
          break;
        case "2":
          input = `文法分析：[${inputValue}]`;
          inputGPT = `幫我分析後方[]內的英文文法結構：[${inputValue}]`;
          break;
        case "3":
          input = `中翻英：[${inputValue}]`;
          inputGPT = `幫我將後方[]內的中文內容翻譯成英文：[${inputValue}]`;
          break;
        case "4":
          input = `英翻中：[${inputValue}]`;
          inputGPT = `幫我將後方[]內的英文內容翻譯成中文：[${inputValue}]`;
          break;
      }
      io.to(user.room).emit('message', generateMessage(user.username, input));
      try {
        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [{ "role": "system", "content": "你是個擅長繁體中文與英文的助理，會使用繁體中文與英文進行翻譯與文法分析" }, { "role": "user", "content": inputGPT }],
        }, {
          timeout: 30000,
        });

        console.log(completion.data.choices[0].message);
        io.to(user.room).emit('message', generateMessage('Admin', completion.data.choices[0].message.content, 'AI'));

      } catch (error) {
        if (error.response) {
          io.to(user.room).emit('message', generateMessage('Admin', error.response.data.message));
          console.log(error.response.status);
          console.log(error.response.data);
        } else {
          io.to(user.room).emit('message', generateMessage('Admin', error.message));
          console.log(error.message);
        }
      }
    } else {
      io.to(user.room).emit('message', generateMessage(user.username, inputValue));
    }

    callback();
  });
  socket.on('sendAiMessage', async ({ inputValue, messages }, callback) => {
    const user = getUser(socket.id);

    const filter = new Filter();
    if (filter.isProfane(inputValue)) {
      return callback('Profanity is not allowed');
    }

    io.to(user.room).emit('message', generateMessage(user.username, inputValue));

    try {
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
        user: `${user.username}${socket.id}`
      }, {
        timeout: 30000,
      });

      console.log(completion.data.choices[0].message);
      io.to(user.room).emit('message', generateMessage('Admin', `${completion.data.choices[0].message.content}`, 'AI'));
      io.to(user.room).emit('reply', { user: user.username, msg: completion.data.choices[0].message.content, messages: messages })
    } catch (error) {
      if (error.response) {
        io.to(user.room).emit('message', generateMessage('Admin', `Hi ${user.username}：Try again`));
        console.log(error.response.status);
        console.log(error.response.data);
      } else {
        io.to(user.room).emit('message', generateMessage('Admin', `${error.message} Please try again`));
        console.log(error.message);
      }
    }

    callback();
  });
  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback('Location shared!');
  });
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      );
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on http://localhost:${port}`);
});
