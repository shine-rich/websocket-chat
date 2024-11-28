function makeHandleEvent(client, clientManager, chatroomManager) {
  function ensureExists(getter, rejectionMessage) {
    return new Promise(function (resolve, reject) {
      const res = getter()
      return res
        ? resolve(res)
        : reject(rejectionMessage)
    })
  }

  function ensureUserSelected(clientId) {
    return ensureExists(
      () => clientManager.getUserByClientId(clientId),
      'select user first'
    )
  }

  function ensureValidChatroom(chatroomName) {
    return ensureExists(
      () => chatroomManager.getChatroomByName(chatroomName),
      `invalid chatroom name: ${chatroomName}`
    )
  }

  function ensureValidChatroomAndUserSelected(chatroomName) {
    return Promise.all([
      ensureValidChatroom(chatroomName),
      ensureUserSelected(client.id)
    ])
      .then(([chatroom, user]) => Promise.resolve({ chatroom, user }))
  }

  function handleEvent(chatroomName, createEntry) {
    return ensureValidChatroomAndUserSelected(chatroomName)
      .then(function ({ chatroom, user }) {
        // append event to chat history
        const entry = { user, ...createEntry() }
        chatroom.addEntry(entry)

        // notify other clients in chatroom
        chatroom.broadcastMessage({ chat: chatroomName, ...entry })
        return chatroom
      })
  }

  return handleEvent
}

module.exports = function (client, clientManager, chatroomManager) {
  const handleEvent = makeHandleEvent(client, clientManager, chatroomManager)
  // Define the chatroom-to-bot association
  const chatroomBots = new Map([
    ["Zen AI", "Jessica"],
    ["Earkick", "Ruby"],
    ["Evan Botpress", "Julian"],
    ["Marvin Botpress", "Ethan"]
  ])
  const counselors = ["Ashley", "James"]

  // Function to find the bot for a given chatroom
  function getBotForChatroom(chatroom) {
    return chatroomBots.get(chatroom) || "No bot assigned to this chatroom";
  }

  function handleRegister(userName, callback) {
    if (!clientManager.isUserAvailable(userName))
      return callback('user is not available')

    const user = clientManager.getUserByName(userName)
    clientManager.registerClient(client, user)

    return callback(null, user)
  }

  function handleJoin(chatroomName, callback) {
    const createEntry = () => ({ event: `joined ${chatroomName}` })
    const userName = clientManager.getUserByClientId(client.id).name
    
    // Temporarily switch role to bot
    const emptyCallback = (err, user) => {
      if (err) console.log("err:", err)
      console.log("user:", user)
    }
    const botName = getBotForChatroom(chatroomName)
    handleRegister(botName, emptyCallback)
    // Announce arrival in chatroom
    handleEvent(chatroomName, createEntry)

    const botRegisterCallback = (err, user) => {
      if (err) console.log("botRegisterCallback err:", err)
      console.log("botRegisterCallback user:", user)
    }
    // Switch role back to user
    handleRegister(userName, botRegisterCallback)

    handleEvent(chatroomName, createEntry)
      .then(function (chatroom) {
        // add member to chatroom
        chatroom.addUser(client)

        // send chat history to client
        callback(null, chatroom.getChatHistory())
      })
      .catch(callback)
  }

  function handleLeave(chatroomName, callback) {
    const createEntry = () => ({ event: `left ${chatroomName}` })

    handleEvent(chatroomName, createEntry)
      .then(function (chatroom) {
        // remove member from chatroom
        chatroom.removeUser(client.id)

        callback(null)
      })
      .catch(callback)
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function handleBotMessage(chatroomName, message) {
    await delay(1000); // Let bot wait for 1 second
    const userName = clientManager.getUserByClientId(client.id).name
    const intervention = "counselor"
    const emptyCallback = (err, user) => {
      if (err) console.log("err:", err)
      console.log("user:", user)
    }

    if (message.includes(intervention)) {
      const botName = getBotForChatroom(chatroomName)
      const botMessage = "I'm here to help, and I think it would be best to connect you with one of our human counselors. They'll take great care of you. Does that sound okay?"
      // Temporarily switch role to Bot
      handleRegister(botName, emptyCallback)
      const createBotEntry = () => ({ message: botMessage })
      // Let bot talk
      handleEvent(chatroomName, createBotEntry)
      
      await delay(3000); // Let counselor wait for 3 seconds
      const counselorMsgs = [
        "I’m here to chat whenever you’re ready.", 
        "You’ve got a friend in me. What’s been happening?", 
        "I’m here if you need to talk about anything.", 
        "Let me know how I can help or if you just want to chat.", 
        "I’m here to chat about whatever you’d like."
      ]
      // Randomly select a msg
      const counselorMessage = counselorMsgs[Math.floor(Math.random() * counselorMsgs.length)]
      const counselorName = counselors[Math.floor(Math.random() * counselors.length)]
      // Temporarily switch role to Counselor
      handleRegister(counselorName, emptyCallback)
      const createCounselorEntry = () => ({ message: counselorMessage })
      // Let counselor talk
      handleEvent(chatroomName, createCounselorEntry)
    } else {
      const botName = getBotForChatroom(chatroomName)
      const botMsgs = [
        "Hello. Let’s take some time to focus on what’s important to you right now.", 
        "Hello, thank you for trusting us. I’m here to offer my support and guidance.", 
        "Hi, I’m here for you. Whatever’s on your mind, we can work through it together.", 
        "Hi, I’m glad to join the conversation. I’m here to listen and support you in the best way I can.", 
        "Hi, I’m here to help make sense of what you’re going through. Let’s talk."
      ]
      // Randomly select a msg
      const botMessage = botMsgs[Math.floor(Math.random() * botMsgs.length)]
      // Temporarily switch role to Bot
      handleRegister(botName, emptyCallback)
      const createBotEntry = () => ({ message: botMessage })
      // Let bot talk
      handleEvent(chatroomName, createBotEntry)      
    }

    // Switch role back to user
    handleRegister(userName, emptyCallback)
  }

  function handleMessage({ chatroomName, message } = {}, callback) {
    const createEntry = () => ({ message })

    handleEvent(chatroomName, createEntry)
      .then(() => callback(null))
      .catch(callback)

    handleBotMessage(chatroomName, message)
  }

  function handleGetChatrooms(_, callback) {
    return callback(null, chatroomManager.serializeChatrooms())
  }

  function handleGetAvailableUsers(_, callback) {
    return callback(null, clientManager.getAvailableUsers())
  }

  function handleDisconnect() {
    // remove user profile
    clientManager.removeClient(client)
    // remove member from all chatrooms
    chatroomManager.removeClient(client)
  }

  return {
    handleRegister,
    handleJoin,
    handleLeave,
    handleMessage,
    handleGetChatrooms,
    handleGetAvailableUsers,
    handleDisconnect
  }
}
