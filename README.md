# dicedicedice

A bot for metaphorically "rolling dice"/generating random values. Made for use with Weaverdice systems.

## Features
- Cool ez syntax blatantly copied from [rollem.rocks](https://rollem.rocks):
> 2d6 - 1

> ` 7 ` ⟵ [3, 5] 2d6 - 1
- "take the lowest" rolls:
> 2l6 + 3

> ` 4 ` ⟵ [4, 1] 2l6 + 3
- "take the highest" rolls:
> 2h6 + 1

> ` 6 ` ⟵ [4, 5] 2h6 + 1
- Multiplication/division/subtraction, whatever you want
> d6 * 1

> d6 x 2

> d6 / 3

> d6 - 4
- Command editing and recalculation!


Invite the bot by clicking [this link](https://discord.com/oauth2/authorize?client_id=1108595011026686002&permissions=3072&scope=bot)

## Installation

This is for self-hosting. Provided the bot is online you can add it to your server simply by clicking the link above.

Yarn:
```
git clone https://github.com/Dakedres/dicedicedice.git
yarn run init
```
npm:
```
git clone https://github.com/Dakedres/dicedicedice.git
npm i
cp template.env .env
```


You will need to provide a token and place it in the .env file.