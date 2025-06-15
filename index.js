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

// Default data
let data = {
  greeted: [],
  messageCounts: {},
  voiceTimes: {},
  voiceDurations: {}
};

// Load saved data if available
if (fs.existsSync(dataFile)) {
  const json = fs.readFileSync(dataFile);
  data = JSON.parse(json);
}

// Save data to file
function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Create Discord client with necessary intents
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

// Login mit Token aus Umgebungsvariable (z.B. in .env Datei oder Hosting-Konfiguration)
client.login(process.env.BOT_TOKEN);

// Welcome neue User in #introductions
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

// Nachrichten zählen & Rollen vergeben
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (!data.messageCounts[userId]) {
    data.messageCounts[userId] = 0;
  }

  data.messageCounts[userId]++;
  saveData();

  console.log(`${message.author.username} has sent ${data.messageCounts[userId]} Messages.`);

  if (data.messageCounts[userId] === 100) {
    const role = message.guild.roles.cache.find(role => role.name === 'Rookie Pilot');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Rookie Pilot! Welcome on Bord! 🚀`);
    }
  }

  if (data.messageCounts[userId] === 250) {
    const role = message.guild.roles.cache.find(role => role.name === 'Wingman');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Wingman! Ready for the next Mission? 🛡️`);
    }
  }

  if (data.messageCounts[userId] === 500) {
    const role = message.guild.roles.cache.find(role => role.name === 'Veteran Pilot');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} is now a Veteran Pilot! Respekt! ✨`);
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

// Voice-Chat-Zeit tracken
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;

  // Beitritt
  if (!oldState.channel && newState.channel) {
    data.voiceTimes[userId] = Date.now();
    saveData();
  }

  // Austritt
  if (oldState.channel && !newState.channel && data.voiceTimes[userId]) {
    const duration = (Date.now() - data.voiceTimes[userId]) / 1000;

    if (!data.voiceDurations[userId]) {
      data.voiceDurations[userId] = 0;
    }
    data.voiceDurations[userId] += duration;

    console.log(`${newState.member.user.username} has spent ${Math.round(data.voiceDurations[userId])} seconds in Voice-Chat.`);

    delete data.voiceTimes[userId];
    saveData();
  }
});

// Befehle
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // !mystats (besteht schon)
  if (command === 'mystats') {
    const userId = message.author.id;
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${message.author.username}, you have sent ${messages} Messages and was ${hours}h ${minutes}m ${seconds}s in Voice-Chat.`);
  }

  // !userstats @User
  if (command === 'userstats') {
    if (args.length === 0) {
      return message.channel.send('Bitte erwähne einen User, z.B. !userstats @User');
    }
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Bitte einen gültigen User erwähnen.');

    const userId = user.id;
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${user.username} hat ${messages} Nachrichten geschrieben und war ${hours}h ${minutes}m ${seconds}s im Voice-Chat.`);
  }

  // !resetstats @User (Admin only)
  if (command === 'resetstats') {
    if (!message.member.permissions.has('ManageGuild')) {
      return message.channel.send('Du hast keine Berechtigung, diesen Befehl zu verwenden.');
    }
    if (args.length === 0) {
      return message.channel.send('Bitte erwähne einen User, z.B. !resetstats @User');
    }
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Bitte einen gültigen User erwähnen.');

    const userId = user.id;
    delete data.messageCounts[userId];
    delete data.voiceDurations[userId];
    delete data.voiceTimes[userId];
    saveData();

    return message.channel.send(`Statistiken von ${user.username} wurden zurückgesetzt.`);
  }

  // !topchatters
  if (command === 'topchatters') {
    // sortiere Nutzer nach Nachrichtenanzahl
    const sortedUsers = Object.entries(data.messageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length === 0) return message.channel.send('Keine Nachrichten-Daten verfügbar.');

    let reply = '**Top 5 Chatter:**\n';
    sortedUsers.forEach(([userId, count], i) => {
      const user = client.users.cache.get(userId);
      const username = user ? user.username : 'Unbekannt';
      reply += `${i + 1}. ${username}: ${count} Nachrichten\n`;
    });

    return message.channel.send(reply);
  }

  // !topvoice
  if (command === 'topvoice') {
    // sortiere Nutzer nach Voice-Zeit
    const sortedUsers = Object.entries(data.voiceDurations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length === 0) return message.channel.send('Keine Voice-Chat-Daten verfügbar.');

    let reply = '**Top 5 Voice-Chat Nutzer:**\n';
    sortedUsers.forEach(([userId, seconds], i) => {
      const user = client.users.cache.get(userId);
      const username = user ? user.username : 'Unbekannt';

      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);

      reply += `${i + 1}. ${username}: ${h}h ${m}m ${s}s\n`;
    });

    return message.channel.send(reply);
  }
});
