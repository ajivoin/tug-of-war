const Discord = require("discord.js");

const client = new Discord.Client();

const { token, prefix } = require("./config.json");

const fs = require("fs");

const WIN = 70;

let data;

const getRandomInt = (max) => {
  return Math.floor(Math.random() * Math.floor(max));
}

fs.stat("data.json", (err, _) => {
  if (err) {
    console.error("Creating data.json...");
    data = { number: 0, users: {}, last: null, channel: null, win: 0 };
  } else {
    data = require("./data.json");
    console.log("Read in data:\n" + JSON.stringify(data));
  }
});
client.once("ready", () => {
  if (data.win === 0) {
    data.win = getRandomInt(WIN);
  }
  console.log("Logged in.");
});

client.on("message", (message) => {
  try {
    if (message.author.bot) return; // message from bot
    if (!message.guild) return; // DM

    const tokens = message.content.toLowerCase().trim().split(" ");
    if (message.content.startsWith(prefix)) {
      const command = tokens[0].substr(prefix.length);
      if (
        message.member.hasPermission("MANAGE_GUILD") &&
        tokens.length > 1 &&
        command === "bind"
      ) {
        channelId = tokens[1].trim().replace(/\D/g, "");
        channel = client.channels
          .fetch(channelId)
          .catch((e) => console.log(e))
          .then(() => (data.channel = channelId));
      }

      if (!data.channel) {
        // unbound
        message.channel.send(
          "Bot must be bound to a channel with `" + prefix + "bind <#channel-name>`."
        );
        return;
      }

      if (message.channel.id !== data.channel) return;
      // not bound channel
      else console.log(message.channel.id, data.channel);
      switch (command) {
        case "help":
          // message.author.dmChannel.send("Help is on the way!");
          return;
        case "current":
          message.channel.send(`Current number is ${data.number}.`);
          return;
        case "target":
          message.channel.send(`Current target is ±${data.win}.`);
          return;
        case "user":
          user = data.users[message.author.id];
          message.channel.send(
            `${message.author}, you have ${user.count} correct counts and ${user.wins} wins.`
          );
        default:
          return;
      }
    }
    number = parseInt(tokens[0]);
    if (data.channel && data.channel === message.channel.id && !isNaN(number)) {
      if (Math.abs(number - data.number) === 1) {
        if (data.last === message.author.id) { // user sent previous message
          message.react("❌");
          return;
        }

        // increment user count
        if (message.author.id in data.users) {
          console.log(`${message.author} count received.`);
          data.users[message.author.id].count++;
        } else {
          console.log(`New user ${message.author}.`);
          data.users[message.author.id] = { count: 1, wins: 0 };
        }

        // check if win
        if (Math.abs(number) == data.win) {
          console.log("Winner. Resetting number.");
          data.users[message.author.id].wins++;
          data.win = getRandomInt(WIN);
          message.react("👑");
          message.channel.send(
            `Congrats ${message.author}! New target: ±${data.win}.`
          );
          data.last = null;
          data.number = number;
        } else {
          data.number = number;
          data.last = message.author.id;
          
          message.react("✅");
        }

      } else {
        console.log("Invalid number.");
        message.react("❌");
      }
    }
  } catch (err) {
    console.error(err);
  }
});


process.on("SIGINT", () => {
  console.log(data);
  fs.writeFileSync("data.json", JSON.stringify(data));
  process.exit(0);
});

client.login(token);
