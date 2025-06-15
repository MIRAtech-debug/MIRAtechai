const fs = require('fs');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(3000, () => {
  console.log('🌐 Webserver läuft auf Port 3000');
});

const { Client, GatewayIntentBits } = require('discord.js');
const dataFile = './data.json';

let data = {
  greeted: [],
  messageCounts: {},
  voiceTimes: {},
  voiceDurations: {}
};

if (fs.existsSync(dataFile)) {
  const json = fs.readFileSync(dataFile);
  data = JSON.parse(json);
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

client.on('messageCreate', (message) => {
  if (message.channel.name === 'introductions' && !message.author.bot) {
    const userId = message.author.id;

    if (!data.greeted.includes(userId)) {
      message.channel.send(`Welcome to the server, ${message.author.username}! 🎉`);
      data.greeted.push(userId);
      saveData();
    }
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (!data.messageCounts[userId]) {
    data.messageCounts[userId] = 0;
  }

  data.messageCounts[userId]++;
  saveData();

  console.log(`${message.author.username} has sent ${data.messageCounts[userId]} messages.`);

  if (data.messageCounts[userId] === 100) {
    const role = message.guild.roles.cache.find(role => role.name === 'Rookie Pilot');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Rookie Pilot! Welcome aboard! 🚀`);
    }
  }

  if (data.messageCounts[userId] === 250) {
    const role = message.guild.roles.cache.find(role => role.name === 'Wingman');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Wingman! Ready for the next mission? 🛡️`);
    }
  }

  if (data.messageCounts[userId] === 500) {
    const role = message.guild.roles.cache.find(role => role.name === 'Veteran Pilot');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Veteran Pilot! Respect! ✨`);
    }
  }

  if (data.messageCounts[userId] === 1000) {
    const role = message.guild.roles.cache.find(role => role.name === 'Fleet Commander');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Fleet Commander! Taken command! 👑`);
    }
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;

  if (!oldState.channel && newState.channel) {
    data.voiceTimes[userId] = Date.now();
    saveData();
  }

  if (oldState.channel && !newState.channel && data.voiceTimes[userId]) {
    const duration = (Date.now() - data.voiceTimes[userId]) / 1000;

    if (!data.voiceDurations[userId]) {
      data.voiceDurations[userId] = 0;
    }
    data.voiceDurations[userId] += duration;

    console.log(`${newState.member.user.username} has spent ${Math.round(data.voiceDurations[userId])} seconds in voice chat.`);

    delete data.voiceTimes[userId];
    saveData();
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'mystats') {
    const userId = message.author.id;
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${message.author.username}, you have sent ${messages} messages and spent ${hours}h ${minutes}m ${seconds}s in voice chat.`);
  }

  if (command === 'userstats') {
    if (args.length === 0) {
      return message.channel.send('Please mention a user, e.g. !userstats @User');
    }
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Please mention a valid user.');

    const userId = user.id;
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${user.username} has sent ${messages} messages and spent ${hours}h ${minutes}m ${seconds}s in voice chat.`);
  }

  if (command === 'resetstats') {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.channel.send('You do not have permission to use this command.');
    }
    if (args.length === 0) {
      return message.channel.send('Please mention a user, e.g. !resetstats @User');
    }
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Please mention a valid user.');

    const userId = user.id;
    delete data.messageCounts[userId];
    delete data.voiceDurations[userId];
    delete data.voiceTimes[userId];
    saveData();

    return message.channel.send(`Statistics for ${user.username} have been reset.`);
  }

  if (command === 'topchatters') {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.channel.send('You do not have permission to use this command.');
    }

    const sortedUsers = Object.entries(data.messageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length === 0) return message.channel.send('No message data available.');

    let reply = '**Top 5 Chatters:**\n';

    Promise.all(sortedUsers.map(async ([userId, count], i) => {
      try {
        const member = await message.guild.members.fetch(userId);
        const username = member.user.username;
        return `${i + 1}. ${username}: ${count} messages`;
      } catch {
        return `${i + 1}. (Unbekannter Nutzer): ${count} messages`;
      }
    })).then(lines => {
      reply += lines.join('\n');
      message.channel.send(reply);
    });
  }

  if (command === 'topvoice') {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.channel.send('You do not have permission to use this command.');
    }

    const sortedUsers = Object.entries(data.voiceDurations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length === 0) return message.channel.send('No voice chat data available.');

    let reply = '**Top 5 Voice Chat Users:**\n';

    Promise.all(sortedUsers.map(async ([userId, seconds], i) => {
      try {
        const member = await message.guild.members.fetch(userId);
        const username = member.user.username;

        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        return `${i + 1}. ${username}: ${h}h ${m}m ${s}s`;
      } catch {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        return `${i + 1}. (Unbekannter Nutzer): ${h}h ${m}m ${s}s`;
      }
    })).then(lines => {
      reply += lines.join('\n');
      message.channel.send(reply);
    });
  }
}); // 👈 DAS HAT GEFEHLT
