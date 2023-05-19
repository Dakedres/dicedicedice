import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv'
import constants from './constants.js';
dotenv.config()

const replies = new Map()

const parseRoll = content => {
  let match = constants.rollRegex.exec(content.trim())

  if(match == null)
    return

  let [
    count,
    mode,
    size,
    modifierString,
    operation,
    modifier
  ] = match.slice(1)

  let description = content.slice(match[0].length)

  return {
    count: count ? parseInt(count) : 1,
    mode,
    size: parseInt(size),
    operation,
    modifier: modifier ? parseInt(modifier) : undefined,
    descriptionConditions: description && parseDescription(description)
  }
}

const parseDescription = description => {
  let conditions = [],
      match

  while((match = constants.descriptionRegex.exec(description)) !== null) {
    // Prevent infinite loops if there's somehow a zero-length match
    if(match.index == constants.descriptionRegex.lastIndex)
      regex.lastIndex++

    let [
      range,
      upperRange,
      content
    ] = match.slice(1)

    conditions.push({
      range: range && {
        lower: range[0],
        upper: upperRange ? upperRange[1] : range[0]
      },
      content: content.trim()
    })
  }

  return conditions
}

const handleMessage = (message, respond) => {
  let dice = parseRoll(message.content)

  if(dice == undefined)
    return // No dice

  if(dice.size > 255) {
    respond('That die is way too big... .-.')
    return
  } else if(dice.size < 2) {
    respond('I cannot even fathom a die with that geometry ;-;')
    return
  }

  if(dice.count > 100) {
    respond('I don\'t have that many dice O_O')
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

  if(dice.descriptionConditions) {
    for(let { range, content } of dice.descriptionConditions) {
      if(!range || result >= range.lower && result <= range.upper)
        response += `'${content}', `
    }
  }
  
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
      .then(reply => rehandleMessage(newMessage, reply) )
      .catch(err => messageCycle(newMessage) )
  } else {
    messageCycle(newMessage)
  }
})

client.login(process.env.DISCORD_TOKEN);
setInterval(pruneReplies, 1000 * 60)
