![an image of the eater](./assets/eater-transparent.png)
# dicedicedice

A discord bot for metaphorically "rolling dice"/generating random values. Made for use with Weaverdice systems.

Icon by [Zauromoun](https://www.tumblr.com/zauromoun)

## Features
- Cool ez syntax blatantly copied from [rollem.rocks](https://rollem.rocks):
> ╭ 2d6 - 1  
> ` 7 ` ⟵ [3, 5] 2d6 - 1
- "take the highest" rolls:
> ╭ 2h6 + 1  
> ` 6 ` ⟵ [4, 5] 2h6 + 1
- "take the lowest" rolls:
> ╭ 2l6 + 3  
> ` 4 ` ⟵ [4, 1] 2l6 + 3
- Multiplication/division/subtraction, whatever you want
> d6 * 1  
> d6 x 2  
> d6 / 3  
> d6 - 4
- Descriptions!
> ╭ 2h6 + 1 eat pant  
> 'eat pant',  7  ⟵ [4, 6] 2h6 + 1
- Outcomes!
> ╭ 2h6 + 1  
> │ -2 your body rejects the pant  
> │ 3-4 you manage to scarf it down  
> │ 5-6 you absorb the nutrients of the pant  
> │ 7- become pant  
> 'your body rejects the pant', ` 2 ` ⟵ [1, 1] 2h6 + 1
- Macros!
> ╭ /macro add name:eatpant dice:d6; -2 your body rejects the pant; 3-4 you manage to  
> │ scarf it down; 5-6 you absorb the nutrients of the pant; 7- become pant  
> Macro added! Try /eatpant!  
> ╭ /eatpant  
> 'you manage to scarf it down',  3  ⟵ [3] 1d6
> ╭ /eatpant +1  
> 'you absorb the nutrients of the pant', ` 5 ` ⟵ [4] 1d6 + 1
> ╭ /eatpant 2h6+3  
> 'become pant', ` 9 ` ⟵ [5, 6] 2h6 + 3
- Command editing and recalculation!  
> There is no demonstration for this

Invite the bot now! By clicking [this link](https://discord.com/oauth2/authorize?client_id=1108595011026686002&permissions=3072&scope=bot)!

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

You will need to place your bot's token and ID in the .env file.