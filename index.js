const express = require('express')
const app = express()
const http = require('http').Server(app)
const socketIO = require('socket.io')(http)

const socketActions = require('./src/constants/socket-actions')
const unstableUnicorns = require('./src/constants/unstable-unicorns')

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Credentials", true)
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, credentials")
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
  res.setHeader("Access-Control-Allow-Origin", "*")
  next()
})

const activeSockets = {}
const activeUnicorns = {}
let messageID = 0
let messages = []

socketIO.on('connection', (socket) => {
  socket.emit(socketActions.CONNECTED)
  console.log(`user ${socket.id} connected`)
  activeSockets[socket.id] = undefined

  socket.on(socketActions.NEW_MESSAGE, (message) => {
    console.log(`user ${socket.id} send message: ${message.messageText}`)
    console.log(`re-playing message ${messageID} to all users`)
    if (message.senderName != null) {
      const newMessage = {
        messageID: messageID,
        messageText: message.messageText,
        messageTimestamp: (new Date()).toUTCString(),
        senderID: socket.id,
        senderName: message.senderName
      }
  
      messages.push(newMessage)
  
      socketIO.sockets.emit(socketActions.NEW_MESSAGE, newMessage)
      messageID += 1
    } else {
      socket.emit(socketActions.FAILED_MESSAGE)
    }
  })

  socket.on(socketActions.LOAD_MESSAGES, () => {
    socket.emit(socketActions.LOAD_MESSAGES, messages)
  })

  socket.on(socketActions.NEW_NAME, () => {
    const newName = getNewName({
      activeNames: activeUnicorns,
      nameList: unstableUnicorns,
      socketID: socket.id
    })

    delete activeUnicorns[activeSockets[socket.id]]
    activeSockets[socket.id] = newName
    activeUnicorns[newName] = socket.id

    socket.emit(socketActions.NEW_NAME, newName)
  })

  socket.on('disconnect', () => {
    console.log(`user ${socket.id} disconnected`)
    activeUnicorns[activeSockets[socket.id]] = null
    delete activeSockets[socket.id]
  })
})

function getNewName({ activeNames, nameList, socketID }) {
  if (nameList.length === Object.keys(activeNames).length) {
    return null
  }

  let newName = nameList[Math.floor(Math.random() * nameList.length)]
  while (activeNames[newName] != undefined && activeNames[newName] !== socketID) {
    newName = nameList[Math.floor(Math.random() * nameList.length)]
  }

  return newName
}

http.listen(8080, () => {
  console.log('listening on *:8080')
})
