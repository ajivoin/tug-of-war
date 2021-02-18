const Discord = require("discord.js");

const client = new Discord.Client();

const { token, prefix } = require("./config.json");

const shop = require("./shop.json");

const fs = require("fs");
const { toNamespacedPath } = require("path");

const WIN = 70;
const CONVERSION_RATE = 100;
const COIN_RATE = 0.01;
const COIN_LOSS = 25;
const COIN_GAIN = 10;

let data;

const getRandomInt = (max) => {
  return Math.floor(Math.random() * Math.floor(max));
}

const reroll = () => {
  data.win = getRandomInt(WIN);
}

const zeroOut = () => {
  data.number = 0;
}

const helpMsgBuilder = () => {
  const commands = require("./commands.json");
  let output = "```\n";
  for (cmd in commands) {
    output += `${prefix}${cmd}: ${commands[cmd]}\n`;
  }
  output += "```";
  return output;
}

const helpMsg = helpMsgBuilder();

const shopListBuilder = () => {
  let list = "```\n";
  for (item in shop) {
    list += `${item} costs ${shop[item]}c\n`;
  }
  list += `Purchase and use an item with ${prefix}buy <item>\n`
  list += "```";
  return list;
}

const shopList = shopListBuilder();

const shopBuy = (user_id, item, callback, errorCallback) => {
  // check item in shop
  if (!(item in shop) && errorCallback) errorCallback(`${item} is not in the shop.`);
  if (user.coins >= shop[item]) {
    const price = shop[item];
    data[user_id].coins -= price;
    switch (item) {
      case "reroll": reroll(); break;
      case "zero": zeroOut(); break;
    }
    if (callback) callback();
  }
  else {
    if (errorCallback) errorCallback("Not enough coins.");
  }
}

const convert = (user_id, callback, errorCb) => {
  if (data.users[user_id].crowns >= 1) {
    data.users[user_id].crowns--;
    data.users[user_id].coins += CONVERSION_RATE;
    if (callback) callback();
  } else {
    if (errorCb) errorCb("Not enough crowns.");
  }
}

const balance = (user_id) => {
  user = data.users[user_id];
  return `Crowns: ${user.crowns}; Coins: ${user.coins}.`
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

const tokenize = (str) => {
  return str.toLowerCase().trim().split(" ");
}

const bind = (messageObj, callback, errorCb) => {
  const tokens = tokenize(messageObj.content);
  if (message.member.hasPermission("MANAGE_GUILD") && tokens.length > 1) {
    channelId = tokens[1].trim().replace(/\D/g, "");
    channel = client.channels
      .fetch(channelId)
      .catch((e) => {errorCb ? errorCb(e) : console.error(e);})
      .then(() => {data.channel = channelId;});
    if (callback) callback();
  } else {
    if (errorCb) errorCb();
  }
}

client.on("message", (message) => {
  try {
    if (message.author.bot) return; // message from bot
    if (!message.guild) return; // DM

    const tokens = tokenize(message.content);
    if (message.content.startsWith(prefix)) {
      const command = tokens[0].substr(prefix.length);
      if (command === "bind") {
        bind(message)
      }
      if (!data.channel) {
        // unbound
        message.channel.send(
          "Bot must be bound to a channel with `" + prefix + "bind <#channel-name>`."
        );
        return;
      }

      if (message.channel.id !== data.channel) return; // wrong channel
      else console.log(message.channel.id, data.channel);
      switch (command) {
        case "help":
          message.channel.send(helpMsg);
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
          return;
        case "shop":
          message.channel.send(shopList);
          return;
        case "buy":
          shopBuy(message.author.id, tokens.length > 1 ? tokens[1] : "", () => {
            message.channel.send(`${message.author} successfully purchased ${tokens[1]}!`);
          }, (errorMsg) => {
            message.channel.send(`${message.author}: ${errorMsg}`);
          });
          return;
        case "convert":
          convert(message.author.id, () => {
            message.channel.send(`${message.author} converted 1 crown to ${CONVERSION_RATE} coins. Your balance is now ${data.users[message.author.id].coins}c.`);
          }, (errorMsg) => {
            message.channel.send(`${message.author}: ${errorMsg}`);
          });
          return;
        case "balance":
          const result = balance(message.author.id);
          if (result) message.channel.send(result);
          return;
        default:
          return;
      }
    }
    number = parseInt(tokens[0]);
    if (data.channel && data.channel === message.channel.id && !isNaN(number)) {
      if (Math.abs(number - data.number) === 1) {
        if (data.last === message.author.id) { // user sent previous message
          message.react("❌");
          data.users[message.author.id].miscount++;
          data.users[message.author.id].coins -= COIN_LOSS;
          
          if (data.users[message.author.id].coins < 0) {
            data.users[message.author.id].coins = 0;
          }
          return;
        }

        // increment user count
        if (message.author.id in data.users) {
          console.log(`${message.author} count received.`);
          data.users[message.author.id].count++;
        } else {
          console.log(`New user ${message.author}.`);
          data.users[message.author.id] = { count: 1, wins: 0, crowns: 0, coins: 0, miscount: 0 };
        }

        // check if win
        if (Math.abs(number) == data.win) {
          console.log("Winner. Resetting number.");
          data.users[message.author.id].wins++;
          data.users[message.author.id].crowns++;
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
          if (Math.random() <= COIN_RATE) {
            data.users[message.author.id].coins += COIN_GAIN;
            message.react("💰");
          } else {
            message.react("✅");
          }
        }

      } else {
        data.users[message.author.id].miscount++;
        data.users[message.author.id].coins -= COIN_LOSS;
        if (data.users[message.author.id].coins < 0) {
          data.users[message.author.id].coins = 0;
        }
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
