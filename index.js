//#region imports
const Discord = require("discord.js");
const fs = require("fs");

const { token, prefix } = require("./config.json");
const shop = require("./shop.json");
//#endregion

//#region constants
const WIN = 70;
const CONVERSION_RATE = 100;
const COIN_RATE = 0.01;
const COIN_LOSS = 25;
const COIN_GAIN = 10;
const [TP_MIN, TP_MAX] = [5, 50];
//#endregion

const createUser = () => {
  return {
    count: 0,
    wins: 0,
    crowns: 0,
    coins: 0,
    miscount: 0,
  };
};

//#region data setup
let data;
fs.stat("data.json", (err, _) => {
  if (err) {
    console.error("Creating data.json...");
    data = {
      number: 0,
      users: {},
      last: null,
      channel: null,
      win: getRandomInt(WIN, 1),
    };
  } else {
    data = require("./data.json");
    console.log("Read in data");
  }
});
//#endregion

// Discord client
const client = new Discord.Client();

const isNullUndefined = (o) => o === null || o === undefined;

const fliparoo = (cb) => {
  [data.win, data.number] = [
    Math.abs(data.number),
    Math.sign(data.number) * data.win,
  ];
  if (cb) cb("😵 Fliparoo! Current number and target are now swapped!");
};

const setReactEmoji = (emoji) => {
  data.emoji = emoji;
};

// max is the only required argument. 0 < min < max
const getRandomInt = (max, min) => {
  if (isNullUndefinedNaN(min)) {
    min = -1;
  }
  return Math.max(min, Math.floor(Math.random() * Math.floor(max)));
};

const addCoins = (userId, amount) => {
  const user = getUser(userId);
  user.coins += amount;
  if (user.coins < 0) user.coins = 0;
};

const addCrowns = (userId, amount) => {
  const user = getUser(userId);
  user.crowns += amount;
  if (user.crowns < 0) user.crowns = 0;
};

const teleport = (cb) => {
  distance = getRandomInt(TP_MAX, TP_MIN);
  if (Math.random() < 0.5) {
    distance = -distance;
  }
  data.number += distance;
  if (Math.abs(data.number) === data.win) data.number++;
  if (cb) cb(`🧙‍♂️ Teleport! Current number is now ${data.number}.`);
};

const reroll = (cb) => {
  data.win = getRandomInt(WIN, 1);
  if (data.win === Math.abs(data.number)) data.win++;
  if (cb) cb(`🎲 Reroll! Target number is now ${data.win}.`);
};

const zeroOut = (cb) => {
  data.number = 0;
  if (cb) cb("💩 Zero! The current number is now 0.");
};

const helpMsgBuilder = () => {
  const commands = require("./commands.json");
  let output = "```\n";
  for (cmd in commands) {
    output += `${prefix}${cmd}: ${commands[cmd]}\n`;
  }
  output += "```";
  return output;
};

const getUser = (userId) => data.users[userId];

const helpMsg = helpMsgBuilder();

const shopListBuilder = () => {
  let list = "```\n";
  for (item in shop) {
    list += `${item} costs ${shop[item]}c\n`;
  }
  list += `Purchase and use an item with ${prefix}buy <item>\n`;
  list += "```";
  return list;
};

const shopList = shopListBuilder();

const shopBuy = (userId, item, callback, errorCallback) => {
  const user = getUser(userId);
  if (!shop.hasOwnProperty(item)) {
    if (errorCallback) errorCallback(`${item} is not in the shop.`);
    return;
  }
  if (user.coins >= shop[item]) {
    const price = shop[item];
    addCoins(userId, -price);
    switch (item) {
      case "reroll":
        reroll(callback);
        break;
      case "zero":
        zeroOut(callback);
        break;
      case "teleport":
        teleport(callback);
        break;
      case "fliparoo":
        fliparoo(callback);
        break;
      case "skin-default":
        setReactEmoji("✅");
        if (callback) callback("✅ New reaction emoji!");
        break;
      case "skin-monke":
        setReactEmoji("🐵");
        if (callback) callback("🐵 New reaction emoji!");
        break;
      case "skin-pancake":
        setReactEmoji("🥞");
        if (callback) callback("🥞 New reaction emoji!");
        break;
      case "skin-brain":
        setReactEmoji("🧠");
        if (callback) callback("🧠 New reaction emoji!");
        break;
      case "skin-flex":
        setReactEmoji("💪");
        if (callback) callback("💪 Weird flex, but okay.");
        break;
      default:
        if (errorCallback) {
          errorCallback(
            `${item} is not in the shop. This shouldn't have happened.`
          );
          addCoins(userId, price);
        }
    }
  } else {
    if (errorCallback) errorCallback("You don't have enough coins.");
  }
};

const convert = (userId, callback, errorCb) => {
  user = getUser(userId);
  if (user.crowns >= 1) {
    addCrowns(userId, -1);
    addCoins(userId, CONVERSION_RATE);
    if (callback) callback("👑💨 You've gained 100c!");
  } else {
    if (errorCb) errorCb("Not enough crowns to convert to coins.");
  }
};

const balance = (userId) => {
  user = getUser(userId);
  return `${user.crowns} Crowns; ${user.coins}c`;
};

client.once("ready", () => {
  if (data.win === undefined || data.win === null || isNaN(data.win)) {
    data.win = getRandomInt(WIN, 1);
  }
  console.log("Logged in.");
});

const tokenize = (str) => {
  return str.toLowerCase().trim().split(" ");
};

const bind = (messageObj, callback, errorCb) => {
  const tokens = tokenize(messageObj.content);
  if (messageObj.member.hasPermission("MANAGE_GUILD") && tokens.length > 1) {
    channelId = tokens[1].trim().replace(/\D/g, "");
    channel = client.channels
      .fetch(channelId)
      .catch((e) => {
        errorCb ? errorCb(e) : console.error(e);
      })
      .then(() => {
        data.channel = channelId;
      });
    if (callback) callback();
  } else {
    if (errorCb) errorCb();
  }
};

client.on("message", (message) => {
  try {
    const author = message.author;
    if (author.bot) return; // message from bot
    if (!message.guild) return; // DM
    const userId = author.id;
    if (!(userId in data.users)) {
      data.users[userId] = createUser();
    }
    const user = getUser(userId);
    const tokens = tokenize(message.content);

    //#region command
    if (message.content.startsWith(prefix)) {
      const command = tokens[0].substr(prefix.length);
      if (command === "bind") {
        bind(message);
      }
      if (!data.channel) {
        // unbound
        message.channel.send(
          "Bot must be bound to a channel with `" +
            prefix +
            "bind <#channel-name>`."
        );
        return;
      }
      // wrong channel, allows bind first though
      if (message.channel.id !== data.channel) return;

      // heavy-lifting for commands
      switch (command) {
        case "h":
        case "?":
        case "help":
          message.channel.send(helpMsg);
          return;
        case "target":
        case "current":
        case "i":
        case "info":
          message.channel.send(
            `Current number is ${data.number}. Target: ±${data.win}.`
          );
          return;
        case "u":
        case "stats":
        case "stat":
        case "user":
          message.channel.send(
            `${author}: ${user.count} numbers counted, ${user.wins} wins, ${user.miscount} goofs.`
          );
          return;
        case "s":
        case "store":
        case "shop":
          message.channel.send(shopList);
          return;
        case "$":
        case "buy":
          shopBuy(
            userId,
            tokens.length > 1 ? tokens[1] : "",
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (errorMsg) => {
              message.channel.send(`${author}: ${errorMsg}`);
            }
          );
          return;
        case "convert":
          convert(
            userId,
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (errorMsg) => {
              message.channel.send(`${message.author}: ${errorMsg}`);
            }
          );
          return;
        case "b":
        case "bal":
        case "balance":
          const result = balance(userId);
          if (result) message.channel.send(`${author}: ${result}`);
          return;
        default:
          return;
      }
    }
    //#endregion

    number = parseInt(tokens[0]);
    if (data.channel && data.channel === message.channel.id && !isNaN(number)) {
      if (data.last === userId) {
        message.react("⏳");
        user.miscount++;
        return;
      }
      if (Math.abs(Math.abs(number) - Math.abs(data.number)) === 1) {
        if (data.last === userId) {
          // user sent previous message
          data.last = userId;
          message.react("❌");
          user.miscount++;
          addCoins(userId, -COIN_LOSS);
          return;
        }

        // increment user count
        if (userId in data.users) {
          user.count++;
        } else {
          console.log(`New user ${author.username}.`);
          data.users[userId] = createUser();
        }

        // check if win
        data.number = number;
        if (Math.abs(number) == data.win) {
          console.log("Winner. Resetting number.");
          user.wins++;
          addCrowns(userId, 1);
          data.win = getRandomInt(WIN, 1);
          message.react("👑");
          message.channel.send(
            `🤴 Congrats ${author}! New target: ±${data.win}.`
          );
          data.last = null;
        } else {
          data.last = Math.abs(Math.abs(number) - data.win) > 1 ? userId : null;
          if (Math.random() <= COIN_RATE) {
            addCoins(userId, COIN_GAIN);
            message.react("💰");
          } else {
            message.react(data.emoji);
          }
        }
      } else {
        data.last = userId;
        user.miscount++;
        addCoins(userId, -COIN_LOSS);
        message.react("❌");
      }
    }
  } catch (err) {
    console.error(err);
  }
});

// ensures data write when server killed
process.on("SIGINT", () => {
  console.log(data);
  fs.writeFileSync("data.json", JSON.stringify(data));
  process.exit(0);
});

client.login(token);
