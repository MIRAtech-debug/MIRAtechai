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
  locked: false, // Neu: Bot Lock Status
};

// Daten laden, falls vorhanden
if (fs.existsSync(dataFile)) {
  const json = fs.readFileSync(dataFile);
  data = JSON.parse(json);
}

function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Webserver
app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Webserver läuft auf Port ${PORT}`);
});

// Discord Client initialisieren
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences, // Für online status
  ],
});

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

// --- Neue Funktion zur Rollenprüfung ---
function hasRole(member, roleNames) {
  return roleNames.some(roleName =>
    member.roles.cache.some(r => r.name.toLowerCase() === roleName.toLowerCase())
  );
}

// --- Auto-Assign "Member" Rolle bei neuem Member ---
client.on('guildMemberAdd', async (member) => {
  const role = member.guild.roles.cache.find(r => r.name === 'Member');
  if (role) {
    try {
      await member.roles.add(role);
      console.log(`Rolle "Member" an ${member.user.username} vergeben.`);
    } catch (err) {
      console.error(`Fehler beim Rollen vergeben: ${err}`);
    }
  }
});

// VoiceState Update - VoiceChat Zeit tracken (unverändert)
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

    console.log(`${newState.member.user.username} hat jetzt insgesamt ${Math.round(data.voiceDurations[userId])} Sekunden im Voice-Chat verbracht.`);

    delete data.voiceTimes[userId];
    saveData();
  }
});

// messageCreate Handler (Erweiterung um neue Commands & Lock-Mechanismus)
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- Bot Lock prüfen ---
  if (data.locked && !hasRole(message.member, ['senates', 'technician'])) {
    return message.channel.send('⚠️ Der Bot ist derzeit gesperrt und kann keine Befehle ausführen.');
  }

  const userId = message.author.id;

  // Begrüßung im introductions-Kanal
  if (message.channel.name === 'introductions') {
    if (!data.greeted.includes(userId)) {
      await message.channel.send(`Welcome to the server, ${message.author.username}! 🎉`);
      data.greeted.push(userId);
      saveData();
    }
  }

  // Nachrichtenzähler & Rollenvergabe
  if (!data.messageCounts[userId]) data.messageCounts[userId] = 0;
  data.messageCounts[userId]++;
  saveData();

  console.log(`${message.author.username} hat ${data.messageCounts[userId]} Nachrichten gesendet.`);

  const count = data.messageCounts[userId];

  const roleNames = [
    { count: 100, name: 'Rookie Pilot', message: 'ist jetzt ein Rookie Pilot! Willkommen an Bord! 🚀' },
    { count: 250, name: 'Wingman', message: 'ist jetzt ein Wingman! Bereit für die nächste Mission? 🛡️' },
    { count: 500, name: 'Veteran Pilot', message: 'ist jetzt ein Veteran Pilot! Respekt! ✨' },
    { count: 1000, name: 'Fleet Commander', message: 'ist jetzt ein Fleet Commander! Hat das Kommando übernommen! 👑' },
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

  // --- Befehle ---
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // --- lockbot & unlockbot ---
  if (command === 'lockbot') {
    if (!hasRole(message.member, ['senates', 'technician'])) {
      return message.channel.send('Du hast keine Berechtigung für diesen Befehl.');
    }
    if (data.locked) return message.channel.send('Der Bot ist bereits gesperrt.');

    data.locked = true;
    saveData();
    return message.channel.send('🔒 Bot wurde gesperrt.');
  }

  if (command === 'unlockbot') {
    if (!hasRole(message.member, ['senates', 'technician'])) {
      return message.channel.send('Du hast keine Berechtigung für diesen Befehl.');
    }
    if (!data.locked) return message.channel.send('Der Bot ist nicht gesperrt.');

    data.locked = false;
    saveData();
    return message.channel.send('🔓 Bot wurde entsperrt.');
  }

  // --- help ---
  if (command === 'help') {
    return message.channel.send(
      `**Verfügbare Commands:**\n` +
      `- !serverstats: Zeigt Serverstatistiken an\n` +
      `- !mystats: Zeigt deine Statistiken\n` +
      `- !userstats @User: Zeigt Statistiken eines Users\n` +
      `- !resetstats @User: Setzt Statistiken zurück (Admin)\n` +
      `- !topchatters: Zeigt die Top 5 Chatter (Admin)\n` +
      `- !topvoice: Zeigt die Top 5 Voice Chat Nutzer (Admin)\n` +
      `- !lockbot: Sperrt den Bot (Senates & Technician)\n` +
      `- !unlockbot: Entsperrt den Bot (Senates & Technician)\n` +
      `- !create event <Name>: Erstellt ein Event (Senates)\n` +
      `- !test: Test-Command (Senates & Technician)`
    );
  }

  // --- serverstats ---
  if (command === 'serverstats') {
    const guild = message.guild;
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const rolesCount = guild.roles.cache.size;

    return message.channel.send(
      `Serverstats für **${guild.name}**:\n` +
      `- Mitglieder gesamt: ${totalMembers}\n` +
      `- Mitglieder online: ${onlineMembers}\n` +
      `- Rollenanzahl: ${rolesCount}`
    );
  }

  // --- test ---
  if (command === 'test') {
    if (!hasRole(message.member, ['technician', 'senates'])) {
      return message.channel.send('Du hast keine Berechtigung für diesen Befehl.');
    }
    return message.channel.send('Test erfolgreich! Der Bot funktioniert.');
  }

  // --- create event ---
  if (command === 'create') {
    if (args[0] !== 'event') return;

    if (!hasRole(message.member, ['senates'])) {
      return message.channel.send('Nur Senates können Events erstellen.');
    }

    const eventName = args.slice(1).join(' ');
    if (!eventName) return message.channel.send('Bitte gib einen Eventnamen an. Beispiel: !create event Raid Night');

    return message.channel.send(`📅 Neues Event erstellt: **${eventName}**\nDatum & Details folgen...`);
  }

  // --- mystats ---
  if (command === 'mystats') {
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${message.author.username}, du hast ${messages} Nachrichten gesendet und ${hours}h ${minutes}m ${seconds}s im Voice-Chat verbracht.`);
  }

  // --- userstats ---
  if (command === 'userstats') {
    if (args.length === 0) return message.channel.send('Bitte erwähne einen Nutzer, z.B. !userstats @User');

    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Bitte erwähne einen gültigen Nutzer.');

    const uid = user.id;
    const messages = data.messageCounts[uid] || 0;
    const voiceTime = Math.round(data.voiceDurations[uid] || 0);

    const hours = Math.floor(voiceTime / 3600);
    const minutes = Math.floor((voiceTime % 3600) / 60);
    const seconds = Math.floor(voiceTime % 60);

    return message.channel.send(`${user.username} hat ${messages} Nachrichten gesendet und ${hours}h ${minutes}m ${seconds}s im Voice-Chat verbracht.`);
  }

  // --- resetstats ---
  if (command === 'resetstats') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.channel.send('Du hast keine Berechtigung für diesen Befehl.');
    }
    if (args.length === 0) return message.channel.send('Bitte erwähne einen Nutzer, z.B. !resetstats @User');

    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Bitte erwähne einen gültigen Nutzer.');

    const uid = user.id;
    delete data.messageCounts[uid];
    delete data.voiceDurations[uid];
    delete data.voiceTimes[uid];
    saveData();

    return message.channel.send(`Statistiken von ${user.username} wurden zurückgesetzt.`);
  }

  // --- topchatters ---
  if (command === 'topchatters') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.channel.send('Du hast keine Berechtigung für diesen Befehl.');
    }

    const sortedUsers = Object.entries(data.messageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length === 0) return message.channel.send('Keine Nachrichtendaten verfügbar.');

    let reply = '**Top 5 Chatter:**\n';

    const lines = await Promise.all(sortedUsers.map(async ([uid, count], i) => {
      try {
        const member = await message.guild.members.fetch(uid);
        return `${i + 1}. ${member.user.username}: ${count} Nachrichten`;
      } catch {
        return `${i + 1}. (Unbekannter Nutzer): ${count} Nachrichten`;
      }
    }));

    reply += lines.join('\n');
    return message.channel.send(reply);
  }

  // --- topvoice ---
  if (command === 'topvoice') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.channel.send('Du hast keine Berechtigung für diesen Befehl.');
    }

    const sortedUsers = Object.entries(data.voiceDurations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (sortedUsers.length === 0) return message.channel.send('Keine Voice-Chat-Daten verfügbar.');

    let reply = '**Top 5 Voice Chat Nutzer:**\n';

    const lines = await Promise.all(sortedUsers.map(async ([uid, seconds], i) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);

      try {
        const member = await message.guild.members.fetch(uid);
        return `${i + 1}. ${member.user.username}: ${h}h ${m}m ${s}s`;
      } catch {
        return `${i + 1}. (Unbekannter Nutzer): ${h}h ${m}m ${s}s`;
      }
    }));

    reply += lines.join('\n');
    return message.channel.send(reply);
  }
});
