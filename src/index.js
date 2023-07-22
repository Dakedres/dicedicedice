import constants from './constants.js'
import { WebSocketServer } from 'ws'
import { EventEmitter } from 'node:events'

let connections = new Map()

//
// Login & events
//

const handleConnection = ws => {
  let client

  ws.on('error', console.error)

  ws.on('message', data => {
    let event

    try {
      event = JSON.parse(data.toString('utf-8') )
    } catch(err) {
      sendToWebsocket(ws, constants.errors.invalidPacket(err) )
      return
    }

    if(typeof event !== 'object' || Array.isArray(event) ) {
      sendToWebsocket(ws, constants.errors.invalidPacket('Event is not an object') )
      return
    }

    console.log(event)

    if(client) {
      if(event.reference && typeof event.reference == 'object')
        sendToWebsocket(ws, constants.errors.invalidReference('Reference cannot be an object') )

      event.client = client
      handleEvent(event)
    } else if(event.type === constants.events.login) {
      client = handleLogin(event, ws)
    }
  })
}

const handleLogin = (event, ws) => {
  if(constants.clients.get(event.name) !== event.password) {
    replyToWebsocket(ws, event, constants.errors.badLogin() )
    return
  }

  console.log('worked?')

  connections.set(event.name, ws)
  replyToWebsocket(ws, event, { type: 'success' })
  return event.name
}

const sendToWebsocket = (ws, event) =>
  ws.send(JSON.stringify(event) )

const replyToWebsocket = (ws, toEvent, withEvent) => {
  let event = {
    ...withEvent,
    reference: toEvent.reference
  }

  console.log(connections)

  return sendToWebsocket(ws, event)
}

const handleEvent = event => {
  if(typeof event.type != 'string') {
    reply(event, constants.errors.invalidPacket("No event type.") )
  }

  bot.emit(event.type, event)
}

const reply = (toEvent, withEvent) =>
  replyToWebsocket(connections.get(toEvent.client), toEvent, withEvent)

//
// Command handling
//

const handleMessage = message => {
  console.log(message)

  let dice = parseRoll(message.content)
  
  const respond = content => reply(message, {
    type: 'message',
    content
  })

  if(dice)
    return rollDice(dice, respond)
}

//
// Rolls
//   Most of this is pulled straight from the original
//   Discord version atm.

const parseRoll = expression => {
  let match = constants.rollRegex.exec(expression.trim())

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

  return {
    count: parseRollInt(count, 1),
    mode,
    size: parseRollInt(size),
    operation,
    modifier: parseRollInt(modifier),
    descriptionConditions: pullDescription(expression, match)
  }
}

const parseRollInt = (value, defaultValue) =>
  value ? parseInt(value) : defaultValue

const pullDescription = (expression, match) => {
  if(match[0].length == expression.length)
    return

  return parseDescription(expression.slice(match[0].length))
}

const rollDice = (dice, respond) => {
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
        .map(n => Math.ceil((n / 256) * dice.size))
  let result = 0
  let operationSymbol = dice.operation
  let response = ''

  switch(dice.mode.toLowerCase()) {
    case 'd': 
      result = rolls.reduce((a, v) => a + v, 0)
      break

    case 'h':
      result = rolls.reduce((a, v) => v > a ? v : a, 0)
      break

    case 'l':
      result = rolls.reduce((a, v) => v < a ? v : a, Infinity)
      break

    case 'f':
      let pseudoMedian = Math.floor(dice.size / 2)
      let resultDistance = -1

      for(let roll of rolls) {
        let distance = Math.abs(roll - pseudoMedian)

        if(distance > resultDistance) {
          result = roll
          resultDistance = distance
        }
      }
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

//
// Hooks
//

const bot = new EventEmitter()

bot.on('message', handleMessage)

const server = new WebSocketServer({
  port: 8080
})

server.on('connection', handleConnection)