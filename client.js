import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import WebSocket from 'ws'
import { error } from 'node:console'

let lastMessage = ''

const writePrompt = () => {
  stdout.write('> ')
  if(lastMessage)
    cli.write(lastMessage)
}

const send = object => new Promise((resolve, reject) => {
  ws.send(JSON.stringify(object), error => {
    if(error)
      reject(error)
  })
})

const handleMessage = async content => {
  lastMessage = content
  
  send({
    type: "message",
    content: content
  })
    .catch(error => {
      console.log(error)
      writePrompt()
    })
}

const printMessage = messageBuf => {
  let indent = ' '.repeat(2)
  let message = messageBuf.toString('utf-8')
  
  message = indent + message.replaceAll('\n', '\n' + indent) + '\n'
  stdout.write(message)
  writePrompt()
}

const start = () => {
  send({
    type: 'login',
    name: 'dev',
    password: 'dev'
  })
  cli.on('line', handleMessage)
}

// 
// Hooks
//

const ws = new WebSocket('ws://localhost:8080')

const cli = readline.createInterface({
  input: stdin,
  output: stdout
})

ws.on('error', console.error)
ws.on('open', start)
ws.on('message', printMessage)
