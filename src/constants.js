const constants = {
  rollRegex: /^(\d+)?([dhl])(\d+)(\s*([+\-*x\/])\s*(\d+))?/,
  optionRollRegex: /^(\d+)?(([dhl])(\d+))?(\s*([+\-*x\/])\s*(\d+))?/,
  descriptionRegex: /\s*((\d*-\d*)|(\d+))?([^;\n]+)/g,
  macroNameRegex: /^[a-z0-9]+$/,

  commands: {
    about: {
      name: 'about',
      description: "Get information about dicedicedice"
    },

    macro: {
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
              required: true
            }
          ]
        }
      ]
    }
  },

  iconUrl: 'https://github.com/Dakedres/dicedicedice/raw/main/assets/eater-transparent.png',

  errorMessage: error => `\
Something went wrong trying to execute that command.
\`\`\`fix
${error.toString()}
\`\`\`
If this issue persists please report it here: <https://github.com/Dakedres/dicedicedice/issues>\
`,

  aboutMessage: (guildCount) => `\
A discord bot for metaphorically "rolling dice"/generating random values. Made for use with Weaverdice systems.

Present in ~${guildCount} guilds!
`
}

export default constants