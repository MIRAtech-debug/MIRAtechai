const fs = require('fs');
const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const app = express();
const dataFile = './data.json';

let data = {
  greeted: [],
  messageCounts: {},
  voiceTimes: {},
  voiceDurations: {},
  locked: false,
  events: []
};

if (fs.existsSync(dataFile)) {
  const json = fs.readFileSync(dataFile);
  data = JSON.parse(json);
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Webserver läuft auf Port ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Admin-Rollenprüfung
function isAdmin(member) {
  return member.roles.cache.some(role =>
    role.name === 'Senator' || role.name === 'Technician🔧'
  );
}

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

// Voice-Zeiterfassung
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;

  if (!oldState.channel && newState.channel) {
    data.voiceTimes[userId] = Date.now();
    saveData();
  }

  if (oldState.channel && !newState.channel && data.voiceTimes[userId]) {
    const duration = (Date.now() - data.voiceTimes[userId]) / 1000;
    if (!data.voiceDurations[userId]) data.voiceDurations[userId] = 0;
    data.voiceDurations[userId] += duration;

    console.log(`${newState.member.user.username} has now spent a total ${Math.round(data.voiceDurations[userId])} Sekunden in Voice-Chat.`);
    delete data.voiceTimes[userId];
    saveData();
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  // Begrüßung
  if (message.channel.name === 'introductions') {
    if (!data.greeted.includes(userId)) {
      await message.channel.send(`Welcome to the server, ${message.author.username}! 🎉`);
      data.greeted.push(userId);
      saveData();
    }
  }

  // Nachrichtenzähler
  if (!data.messageCounts[userId]) data.messageCounts[userId] = 0;
  data.messageCounts[userId]++;
  saveData();

  console.log(`${message.author.username} has sent ${data.messageCounts[userId]} Messages.`);

  const count = data.messageCounts[userId];
  const roleNames = [
    { count: 100, name: 'Rookie Pilot', message: 'is now a Rookie Pilot! Welcome aboard! 🚀' },
    { count: 250, name: 'Wingman', message: 'is now a Wingman! Ready for the next mission? 🛡️' },
    { count: 500, name: 'Veteran Pilot', message: 'is now a Veteran Pilot! Respect! ✨' },
    { count: 1000, name: 'Fleet Commander', message: 'is now a Fleet Commander! Taken command! 👑' },
  ];

  for (const roleInfo of roleNames) {
    if (count === roleInfo.count) {
      const role = message.guild.roles.cache.find(r => r.name === roleInfo.name);
      if (role) {
        await message.member.roles.add(role);
        await message.channel.send(`${message.author.username} ${roleInfo.message}`);
      }
      break;
    }
  }

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // 🔹 STATS COMMANDS
  if (command === 'mystats') {
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${message.author.username}, you have sent ${messages} Messages and spent ${hours}h ${minutes}m ${seconds}s in Voice-Chat.`);
  }

  if (command === 'userstats') {
    if (args.length === 0) return message.channel.send('Please mention a user, e.g. !userstats @User');
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Please mention a valid user.');
    const uid = user.id;
    const messages = data.messageCounts[uid] || 0;
    const voiceTime = Math.round(data.voiceDurations[uid] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${user.username} has sent ${messages} Messages and spent ${hours}h ${minutes}m ${seconds}s in Voice-Chat.`);
  }

  // 🔹 ADMIN COMMANDS (Se
