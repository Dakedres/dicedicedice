import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv'
import constants from './constants.js';
import { ClassicLevel } from 'classic-level';

dotenv.config()

const replies = new Map()
const commands = new Map()
const db = new ClassicLevel('./db')
const macroCache = new Map()
 
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
  if(match[0].length == expression.length)
    return

  return parseDescription(expression.slice(match[0].length))
}

const parseDescription = description => {
  let conditions = []
  let match

  while((match = constants.descriptionRegex.exec(description)) !== null) {
    let range
    let [
      rangeExp,
      valueExp,
      content
    ] = match.slice(2)

    if(rangeExp) {
      let split = rangeExp.split('-')

      range = {
        lower: parseRollInt(split[0], -Infinity),
        upper: parseRollInt(split[1], Infinity)
      }
    } else if(valueExp) {
      range = {
        upper: valueExp,
        lower: valueExp
      }
    }

    conditions.push({
      range,
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

const handleError = (interaction) => (error) =>
  interactionRespond(interaction, constants.errorMessage(error) )
    .catch(reportingError => console.error('Could not display error message:\n  ', reportingError) )


const addCommand = (data, callback) => {
  commands.set(data.name, {
    data,
    execute: callback
  })
}

const addSubcommands = (data, subcommandCallbacks) =>
  addCommand(data, interaction => {
    return subcommandCallbacks[interaction.options.getSubcommand()](interaction)
  })

const openMacros = guildId =>
  db.sublevel(guildId).sublevel('macros')

const reloadMacros = async guildId => {
  let commands = []
  let macros = openMacros(guildId)
  let cacheEntry = {}

  for await (let [ name, dice ] of macros.iterator() ) {
    cacheEntry[name] = dice

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
  }

  macroCache.set(guildId, cacheEntry)

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

    if(validIds.includes(guildId))
      continue

    if(client.guilds.cache.has(guildId)) {
      validIds.push(guildId)
    } else {
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

const openResponses = (interaction, ephemeral) => async content =>
  interaction.reply({ content, ephemeral })

addSubcommands({
  name: 'macro',
  description: "Manage macros",
  options: [
    {
      name: 'add',
      description: "Define a dice macro",
      type: 1, // Sub command
      options: [ 
        {
          name: "name",
          description: "Name of the macro",
          type: 3, // String
          required: true
        },
        {
          name: "dice",
          description: "The dice expression to save as a macro",
          type: 3, // String
          required: true
        }
      ]
    },
    {
      name: 'remove',
      description: "Remove a macro",
      type: 1, // Sub command
      options: [ 
        {
          name: "name",
          description: "Name of the macro",
          type: 3, // String
          required: true,
          autocomplete: true,
          getAutocomplete: interaction => {
            let macros = macroCache.get(interaction.guild.id)

            return macros ? Object.keys(macros) : []
          }
        }
      ]
    }
  ]
}, {
  add: async interaction => {
    let name = interaction.options.get('name').value.toLowerCase()
    let respond = openResponses(interaction, true)
  
    if(!constants.macroNameRegex.test(name))
      return respond("Please provide a macro name that consists of only alphanumeric characters.")

    if(commands.has(name))
      return respond("Uhh,, I think that macro name is already taken by my own commands, sorry.")

    let dice = interaction.options.get('dice').value

    if(!constants.rollRegex.test(dice) )
      return respond("Please provide a valid roll expression.")

    await interaction.deferReply({ ephemeral: true })

    await Promise.all([
      openMacros(interaction.guild.id).put(name, dice),
      reloadMacros(interaction.guild.id)
    ])
    interaction.followUp(`Macro added! Try \`/${name}\`! You might need to switch to a different server and back or reopen Discord in order for it to recognize the new command.`)
  },
  remove: async interaction => {
    let name = interaction.options.get('name').value.toLowerCase()
    let macros = macroCache.get(interaction.guild.id)
    let respond = openResponses(interaction, true)
    
    if(!macros)
      return respond('There aren\'t even any macros in this guild!')

    let dice = macros && macroCache.get(interaction.guild.id)[name]

    if(!dice)
      return respond("There isn't a macro with that name .-.")

    await interaction.deferReply({ ephemeral: true })
    await Promise.all([
      openMacros(interaction.guild.id).del(name),
      reloadMacros(interaction.guild.id)
    ])

    await interaction.followUp(`Removed \`${name}\`, its dice expression was: \`\`\`${dice}\`\`\``)
  }
})



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
    await reloadMacros(guildId)

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

const handleCommand = async interaction => {
  if(commands.has(interaction.commandName) ) {
    commands.get(interaction.commandName).execute(interaction)
      .catch(handleError(interaction))
    return
  }

  await interaction.deferReply()
  let roll = macroCache.get(interaction.guild.id)[interaction.commandName]

  if(roll) {
    let dice = parseRoll(roll)
    let options = interaction.options.get('options')
    
    if(options) {
      let optionDice = parseOptionRoll(options.value)

      for(let [ key, value ] of Object.entries(optionDice)) {
        if(value)
          dice[key] = Array.isArray(value) ? value.concat(dice[key]) : value
      }
    }

    rollDice(dice, content => interaction.followUp(content) )
  }
}

const findOption = (options, name) =>
  options.find(option => option.name == name)

const handleAutocomplete = async interaction => {
  if(commands.has(interaction.commandName) ) {
    let { data } = commands.get(interaction.commandName)
    let subcommand = interaction.options.getSubcommand() 
    let focusedOption = interaction.options.getFocused(true) 

    if(subcommand !== undefined) {
      data = findOption(data.options, subcommand)
    }

    let option = findOption(data.options, focusedOption.name)

    if(!option) {
      console.error('Could not find option: ' + focusedOption)
      return
    }

    let filtered = option
      .getAutocomplete(interaction)
      .filter(choice => choice.startsWith(focusedOption.value) )
      .map(choice => ({ name: choice, value: choice }) )

    await interaction.respond(filtered)
  }
}

client.on('interactionCreate', interaction => {
  if(interaction.isChatInputCommand()) {
    return handleCommand(interaction)
  } else if(interaction.isAutocomplete()) {
    return handleAutocomplete(interaction)
      .catch(console.error)
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
