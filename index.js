//#region imports
const Discord = require("discord.js");
const fs = require("fs");
const { isNull } = require("util");

const { token, prefix } = require("./config.json");
const shop = require("./shop.json");
const skins = require("./skins.json");
//#endregion

//#region constants
const REACT_CORRECT = "✅";
const REACT_INCORRECT = "❌";
const REACT_TIMEOUT = "⏳";
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
    reactions: {},
    powerups: {
      reroll: 0,
      teleport: 0,
      fliparoo: 0,
      zero: 0,
    },
  };
};

const getDataSchema = () => {
  return {
    number: 0,
    users: {},
    last: null,
    channel: null,
    win: getRandomInt(WIN, 1),
    correctEmoji: REACT_CORRECT,
    incorrectEmoji: REACT_INCORRECT,
    timeoutEmoji: REACT_TIMEOUT,
  };
};

//#region data setup
let data;
fs.stat("data.json", (err, _) => {
  if (err) {
    console.error("Creating data.json...");
    data = getDataSchema();
  } else {
    data = require("./data.json");
    console.log("Read in data");
  }
});

const persistData = () => {
  fs.writeFileSync("data.json", JSON.stringify(data));
  console.log("Data saved.");
};

const dataPersistenceId = setInterval(persistData, 1000 * 60 * 5);
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

const buyReactSkin = (userId, reactionId, callback, errorCb) => {
  const user = getUser(userId);

  // check if user owns react
  if (
    !user.reactions.hasOwnProperty(reactionId) &&
    shop.hasOwnProperty(reactionId)
  ) {
    for (let reaction in user.reactions) {
      user.reactions[reaction] = false;
    }
    user.reactions[reactionId] = true;
    const emoji = skins[reactionId];
    if (callback) callback(`${emoji} You bought a reaction skin!`);
  } else {
    if (errorCb) errorCb("You already have this reaction or it doesn't exist.");
  }
};

const disableReactions = (userId) => {
  const user = getUser(userId);

  for (let reaction in user.reactions) {
    user.reactions[reaction] = false;
  }
};

const setReactEmoji = (userId, reactionId, callback, errorCb) => {
  const user = getUser(userId);
  if (isNullUndefined(reactionId)) return;
  if (user.reactions.hasOwnProperty(reactionId)) {
    disableReactions(userId);
    user.reactions[reactionId] = true;
    const emoji = skins[reactionId];
    if (callback) callback(`${emoji} You equipped a reaction skin!`);
  } else {
    if (errorCb) errorCb("You do not own this reaction skin.");
  }
};

const getReactEmoji = (userId) => {
  const user = getUser(userId);
  for (let reaction in user.reactions) {
    if (user.reactions[reaction]) return skins[reaction];
  }
  return data.correctEmoji;
};

// max is the only required argument. 0 < min < max
const getRandomInt = (max, min) => {
  if (isNullUndefined(min)) {
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
  if (cb) cb(`🎲 Reroll! Target number is now ±${data.win}.`);
};

const zeroOut = (cb) => {
  data.number = 0;
  if (cb) cb("💩 Zero! The current number is now 0.");
};

const helpMsgBuilder = () => {
  const commands = require("./commands.json");
  let output = "```\n";
  for (let cmd in commands) {
    output += `${prefix}${cmd}: ${commands[cmd]}\n`;
  }
  output += "```";
  return output;
};

const getUserReactions = (userId) => {
  let output = "Your reactions:\n```\n";
  const user = getUser(userId);
  for (let react in user.reactions) {
    output += `${skins[react]}: ${react}\n`;
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
    // if (errorCallback) errorCallback(`${item} is not in the shop.`);
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
      case "nice":
        data.number = 69;
        data.last = null;
        callback(`Nice 😎.`);
        break;
      case "skin-default":
        buyReactSkin(userId, "skin-default", callback, errorCallback);
        break;
      case "skin-monke":
        buyReactSkin(userId, "skin-monke", callback, errorCallback);
        break;
      case "skin-pancake":
        buyReactSkin(userId, "skin-pancake", callback, errorCallback);
        break;
      case "skin-brain":
        buyReactSkin(userId, "skin-brain", callback, errorCallback);
        break;
      case "skin-flex":
        buyReactSkin(userId, "skin-flex", callback, errorCallback);
        break;
      case "skin-sparkle":
        buyReactSkin(userId, "skin-sparkle", callback, errorCallback);
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

const handleConvert = (userId, arg, callback, errorCb) => {
  const number = parseInt(arg);
  const user = getUser(userId);
  if (isNullUndefined(arg)) {
    convert(userId, callback, errorCb);
    return;
  }
  if (!isNaN(number)) {
    if (number <= 0) return;
    if (user.crowns >= number) {
      const increase = number * CONVERSION_RATE;
      user.crowns -= number;
      user.coins += number * CONVERSION_RATE;
      if (callback) {
        callback(`👑💨 You've gained ${number * CONVERSION_RATE}c!`);
      }
      return;
    } else {
      if (errorCb) {
        errorCb(
          `Oopsies! You have ${user.crowns} Crowns and tried to convert ${number}.`
        );
      }
      return;
    }
  } else if (arg.toLowerCase() === "all" && user.crowns > 0) {
    const increase = user.crowns * CONVERSION_RATE;
    user.coins += increase;
    user.crowns = 0;
    if (callback) {
      callback(`👑💨 You've gained ${increase}c!`);
    }
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
          handleConvert(
            userId,
            tokens[1],
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (errorMsg) => {
              message.channel.send(`${author}: ${errorMsg}`);
            }
          );
          return;
        case "e":
        case "equip":
          setReactEmoji(
            userId,
            tokens[1],
            (msg) => {
              message.channel.send(`${author}: ${msg}`);
            },
            (err) => {
              message.channel.send(`${author}: ${err}`);
            }
          );
          return;
        case "inv":
        case "inventory":
          message.channel.send(`${author}: ${getUserReactions(userId)}`);
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
      if (Math.abs(number - data.number) === 1) {
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
            const gain = getRandomInt(100, 10);
            addCoins(userId, gain);
            message.react("💰");
          } else if (Math.abs(data.number) == 69) {
            message.react("😎");
          } else {
            message.react(getReactEmoji(userId));
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
  persistData();
  process.exit(0);
});

client.login(token);
