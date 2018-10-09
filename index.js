const express = require('express')
const app = express()
const http = require('http').Server(app)
const socketIO = require('socket.io')(http)

const debug = require('debug')('http')
const fs = require('fs')
const morgan = require('morgan')
const path = require('path')

const socketActions = require('./src/constants/socket-actions')
const unstableUnicorns = require('./src/constants/unstable-unicorns')

const clientApp = process.env.NODE_ENV === 'production'
? 'https://unstable-stable.netlify.com'
: 'http://localhost:3000'

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Credentials", true)
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, credentials")
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
  res.setHeader("Access-Control-Allow-Origin", clientApp)
  next()
})

app.use(morgan('combined', {
  stream: fs.createWriteStream(path.join(__dirname, 'socket-events.log'), { flags: 'a'})
}))

const activeSockets = {}
const activeUnicorns = {}
let messageID = 0
let messages = []

socketIO.on('connection', (socket) => {
  socket.emit(socketActions.CONNECTED)
  debug(`socket ${socket.id} connected`)
  activeSockets[socket.id] = undefined

  socket.on(socketActions.NEW_MESSAGE, (message) => {
    debug(`socket ${socket.id} sent message: ${message.messageText}`)

    if (message.senderName != null) {
      const newMessage = {
        messageID: messageID,
        messageText: message.messageText,
        messageTimestamp: (new Date()).toUTCString(),
        senderID: socket.id,
        senderName: message.senderName
      }
  
      messages.push(newMessage)

      debug(`re-playing message ${messageID} to all sockets`)
      socketIO.sockets.emit(socketActions.NEW_MESSAGE, newMessage)
      messageID += 1
    } else {
      debug(`failed message to socket ${socket.id}`)
      socket.emit(socketActions.FAILED_MESSAGE)
    }
  })

  socket.on(socketActions.LOAD_MESSAGES, () => {
    debug(`sending messages to socket ${socket.id}`)
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

    debug(`sending new name ${newName} to socket ${socket.id}`)
    socket.emit(socketActions.NEW_NAME, newName)
  })

  socket.on('disconnect', () => {
    debug(`socket ${socket.id} disconnected`)

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

http.listen(process.env.PORT || 8080, () => {
  const port = http.address().port
  debug(`Listening on port ${port}`)
})
