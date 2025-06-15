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

  console.log(`${message.author.username} hat ${data.messageCounts[userId]} Nachrichten gesendet.`);

  if (data.messageCounts[userId] === 100) {
    const role = message.guild.roles.cache.find(role => role.name === 'Rookie Pilot');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} ist jetzt ein Rookie Pilot! Willkommen an Bord! 🚀`);
    }
  }

  if (data.messageCounts[userId] === 250) {
    const role = message.guild.roles.cache.find(role => role.name === 'Wingman');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} ist jetzt ein Wingman! Bereit für die nächste Mission? 🛡️`);
    }
  }

  if (data.messageCounts[userId] === 500) {
    const role = message.guild.roles.cache.find(role => role.name === 'Veteran Pilot');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} ist jetzt ein Veteran Pilot! Respekt! ✨`);
    }
  }

  if (data.messageCounts[userId] === 1000) {
    const role = message.guild.roles.cache.find(role => role.name === 'Fleet Commander');
    if (role) {
      message.member.roles.add(role);
      message.channel.send(`${message.author.username} ist jetzt ein Fleet Commander! Kommando übernommen! 👑`);
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

    console.log(`${newState.member.user.username} war insgesamt ${Math.round(data.voiceDurations[userId])} Sekunden im Voice-Chat.`);

    delete data.voiceTimes[userId];
    saveData();
  }
});

// !mystats Befehl
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const [command] = message.content.slice(prefix.length).trim().split(/\s+/);

  if (command === 'mystats') {
    const userId = message.author.id;
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    message.channel.send(`${message.author.username}, du hast ${messages} Nachrichten gesendet und warst ${hours}h ${minutes}m ${seconds}s im Voice-Chat.`);
  }
});
