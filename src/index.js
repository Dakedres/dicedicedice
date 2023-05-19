import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv'
dotenv.config()

const regex = /^(\d+)?([dhl])(\d+)(\s*([+\-*x\/])\s*(\d+))?(.*?)$/

const replies = new Map()

const parseMatch = match => {
  let [
    count,
    mode,
    size,
    modifierString,
    operation,
    modifier,
    description
  ] = match.slice(1)

  return {
    count: count ? parseInt(count) : 1,
    mode,
    size: parseInt(size),
    operation,
    modifier: modifier ? parseInt(modifier) : undefined,
    description: description.trim()
  }
}

const handleMessage = (message, respond) => {
  let match = regex.exec(message.content.trim())

  if(match == null)
    return

  let dice = parseMatch(match)

  if(dice.size > 256) {
    respond('That die is way too big... .-.')
    return
  }

  let rolls = [ ...crypto.getRandomValues(new Uint8Array(dice.count) ) ]
        .map(n => Math.ceil((n / 256) * dice.size)),
      result = 0,
      operationSymbol = dice.operation,
      response = ''

  switch(dice.mode) {
    case 'd': 
      result = rolls.reduce((a, v) => a + v, 0)
      break

    case 'h':
      result = rolls.reduce((a, v) => v > a ? v : a, 0)
      break

    case 'l':
      result = rolls.reduce((a, v) => v < a ? v : a, Infinity)
      break
  }

  switch(dice.operation) {
    case '+':
      result += dice.modifier
      break

    case '-':
      result -= dice.modifier
      break

    case 'x':
      operationSymbol = '*'
    case '*':
      result = result * dice.modifier
      break

    case '/':
      result = result / dice.modifier
      break
  }

  if(dice.description)
    response += `'${dice.description}', `
  
  response += `\` ${result} \` \u27F5 [${rolls.join(', ')}] ${dice.count + dice.mode + dice.size}`

  if(dice.operation) {
    response += ' ' + operationSymbol + ' ' + dice.modifier 
  }

  respond(response)
}

const saveReply = (message, reply) => {
  replies.set(message.id, {
    id: reply.id,
    timestamp: Date.now()
  })
}

const messageCycle = async message => {
  handleMessage(message, async content => {
    saveReply(message, await message.reply(content) )
  })
}

const rehandleMessage = async (message, reply) => {
  handleMessage(message, async content => {
    saveReply(message, await reply.edit(content) )
  })
}

const pruneReplies = () => {
  for(let [ id, entry ] of replies.entries()) {
    let age = Date.now() - entry.timestamp

    if(age > 1000 * 60 * 3) {
      replies.delete(id)
    }
  }
}

const client = new Client({
  intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
  ]
})

client.on('ready', () => {
  console.log("Logged in!")
})

client.on('messageCreate', messageCycle)

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if(replies.has(newMessage.id) ) {
    let { id } = replies.get(newMessage.id)

    newMessage.channel.messages.fetch(id)
      .then(reply => rehandleMessage(newMessage, reply))
      .catch(err => messageCycle(newMessage, ) )
  } else {
    messageCycle(newMessage)
  }
})

client.login(process.env.DISCORD_TOKEN);
setInterval(pruneReplies, 1000 * 60)
