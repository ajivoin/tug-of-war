# tug-of-war

Single-server Discord bot that makes counting competitive.

## Development

0. Install Node.js and npm.
1. Clone the repository.
2. Run `npm install`.
3. Set up the `config.js` file. (See the [Discord Developer Portal](https://discord.com/developers/applications/) to get your Bot Token)
4. Run `npm start`.

## Deployment

1. Generate an OAuth invite link on the [Discord Developer Portal](https://discord.com/developers/applications/).
    * In the OAuth tab, select the `bot` scope and these permissions: `send messages, embed links, attach files, read message history, add reactions`.
2. Invite your bot to a Discord server.
3. Create a `#tug-of-war` channel.
4. In `#tug-of-war`, write `t?bind` to get the bot in your channel.

## Usage

Type `t?help` to see what commands you can use.

## Contributing

0. Follow [Development](#development) instructions.
1. Implement and document your feature.
2. Manually test your feature and document how you tested it.
3. Run `npm run lint` and ensure you have **no lint errors**.
4. Create a pull request including documentation of your feature and how you tested it.
