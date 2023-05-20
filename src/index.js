import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv'
import constants from './constants.js';
import { ClassicLevel } from 'classic-level';

dotenv.config()

const replies = new Map()
const commands = new Map()
const db = new ClassicLevel('./db')
 
const parseRollInt = (value, defaultValue) =>
  value ? parseInt(value) : defaultValue

const parseOptionRoll = expression => {
  let match = constants.optionRollRegex.exec(expression.trim())

  let [ 
    count,
    modeSize,
    mode,
    size,
    operationModifier,
    operation,
    modifier
  ] = match
    .slice(1)
    .map(v => v == undefined ? null : v) // Allow us to merge it easier

  return {
    count: parseRollInt(count),
    mode,
    size: parseRollInt(size),
    operation,
    modifier: parseRollInt(modifier),
    descriptionConditions: pullDescription(expression, match)
  }
}

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

const pullDescription = (expression, match) => {
  let description = expression.slice(match[0].length)

  return description && parseDescription(description)
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
      upperRangeExpression,
      upperRange,
      content
    ] = match.slice(1)

    let lower = range[0],
        upper

    if(!upperRange) {
      // Allow "X-" ranges to represent anything higher than X
      upper = upperRangeExpression ? Infinity : lower
    } else {
      upper = upperRange[0]
    }

    conditions.push({
      range: range && {
        lower,
        upper
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

  rollDice(dice, respond)
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

const interactionRespond = (interaction, content) => {
  let reply = { content, ephemeral: true }

  if(interaction.replied || interaction.deferred) {
    return interaction.followUp(reply)
  } else {
    return interaction.reply(reply)
  }
}

const handleError = (error, interaction) =>
  interactionRespond(interaction, constants.errorMessage(error) )
    .catch(reportingError => console.error('Could not display error message:\n  ', reportingError) )


const addCommand = (data, callback) => {
  commands.set(data.name, {
    data,
    execute: callback
  })
}

const openMacros = guildId =>
  db.sublevel(guildId).sublevel('macros')

const registerMacroCommands = async guildId => {
  let commands = []
  let macros = openMacros(guildId)

  for await (let [ name, dice ] of macros.iterator() )
    commands.push({
      name,
      description: elipsify("Roll " + dice.replaceAll('\n', ';'), 100),
      options: [
        {
          name: "options",
          description: "Dice, modifiers, or descriptions to apply over the macro",
          type: 3
        }
      ]
    })

  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_ID, guildId),
    { body: commands }
  )
}

const elipsify = (string, maxLength) =>
  string.length > maxLength ? string.slice(0, maxLength - 3) + '...' : string

const pruneDB = async () => {
  let validIds = []

  for await(let key of db.keys()) {
    let [ guildId ] = key.split('!').slice(1)

    console.log(guildId)

    if(validIds.includes(guildId))
      continue

    if(client.guilds.cache.has(guildId)) {
      validIds.push(guildId)
    } else {
      console.log('Pruning key: ' + key)
      await db.del(key)
    }
  }

  return validIds
}


addCommand(
  constants.commands.about,
  async interaction => {
    let embed = {
      title: 'dicedicedice',
      thumbnail: {
        url: constants.iconUrl
      },
      description: constants.aboutMessage(client.guilds.cache.size) 
    } 

    await interaction.reply({
      embeds: [ embed ],
      ephemeral: true
    })
  }
)

addCommand(
  constants.commands.macro,
  async interaction => {
    let name = interaction.options.get('name').value.toLowerCase()
    
    if(!constants.macroNameRegex.test(name) ) {
      interaction.reply("Please provide a macro name that consists of only alphanumeric characters.")
      return
    }

    if(commands.has(name)) {
      interaction.reply("Uhh... I think that macro name is already taken by my own commands, sorry.")
      return
    }

    // let dice = parseRoll(interaction.options.get('dice').value)
    let dice = interaction.options.get('dice').value

    if(!constants.rollRegex.test(dice) ) {
      interaction.reply("Please provide a valid roll expression.")
      return
    }

    // let exists = true
    // let macros = openTable(interaction.guild, 'macros')
    // let macro = await macros.get(name)
    //   .catch(err => {
    //     if(err.code == 'LEVEL_NOT_FOUND')
    //       exists = false
    //     else
    //       handleError(err, interaction)
    //   })

    // if(exists) {
    //   interaction.followUp('A macro with this name already exists in this guild.')
    //   return
    // }

    await interaction.deferReply()

    let macros = openMacros(interaction.guild.id)

    await Promise.all([
      macros.put(name, dice),
      registerMacroCommands(interaction.guild.id)
    ])
    interaction.followUp(`Macro added! Try \`/${name}\``)
  }
)



const client = new Client({
  intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
  ]
})

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

client.on('ready', async () => {
  console.log("Logged in!")

  let guildIds = await pruneDB()

  for(let guildId of guildIds)
    await registerMacroCommands(guildId)

  console.log("Ready")
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

client.on('interactionCreate', async interaction => {
  if(!interaction.isChatInputCommand())
    return

  if(commands.has(interaction.commandName) ) {
    commands.get(interaction.commandName).execute(interaction)
      .catch(err => handleError(err, interaction) )
    return
  }

  let roll = await openMacros(interaction.guild.id).get(interaction.commandName)

  if(roll) {
    let dice = parseRoll(roll)
    let optionsRoll = interaction.options.get('options').value
    
    if(optionsRoll) {
      let optionDice = parseOptionRoll(optionsRoll)

      for(let [ key, value ] of Object.entries(optionDice)) {
        if(value)
          dice[key] = value
      }

      console.log(dice)
    }

    rollDice(dice, content => interaction.reply(content) )
  }
})



;(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_ID),
    {
      body: [ ...commands.values() ]
        .map(command => command.data )
    }
  )
    .catch(err => console.error('Command registration failed: ', err) )  

  await client.login(process.env.DISCORD_TOKEN)
    .catch(err => console.error('Login failed: ', err) )

  setInterval(pruneReplies, 1000 * 60)
})()
