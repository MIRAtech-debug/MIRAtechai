const fs = require('fs');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require('discord.js');

const app = express();
const dataFile = './data.json';

let data = {
  greeted: [],
  messageCounts: {},
  voiceTimes: {},
  voiceDurations: {},
  locked: false,
  events: [],
  tempEvents: {}
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

function isAdmin(member) {
  return member.roles.cache.some(role =>
    role.name === 'Senator' || role.name === 'Technician🔧'
  );
}

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;

  if (!oldState.channel && newState.channel) {
    data.voiceTimes[userId] = Date.now();
    saveData();
  }

  if (oldState.channel && !newState.channel && data.voiceTimes[userId]) {
    const duration = (Date.now() - data.voiceTimes[userId]) / 1000;
    data.voiceDurations[userId] = (data.voiceDurations[userId] || 0) + duration;
    delete data.voiceTimes[userId];
    saveData();
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;

  if (message.channel.name === 'introductions' && !data.greeted.includes(userId)) {
    await message.channel.send(`Welcome to the server, ${message.author.username}! 🎉`);
    data.greeted.push(userId);
    saveData();
  }

  data.messageCounts[userId] = (data.messageCounts[userId] || 0) + 1;
  saveData();

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

  if (data.locked && !isAdmin(message.member)) return message.channel.send('🚫 Bot is currently locked by an admin.');

  if (command === 'mystats') {
    const messages = data.messageCounts[userId] || 0;
    const voiceTime = Math.round(data.voiceDurations[userId] || 0);
    const h = Math.floor(voiceTime / 3600);
    const m = Math.floor((voiceTime % 3600) / 60);
    const s = Math.floor(voiceTime % 60);
    return message.channel.send(`${message.author.username}, you have sent ${messages} Messages and spent ${h}h ${m}m ${s}s in Voice-Chat.`);
  }

  if (command === 'userstats') {
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Please mention a valid user.');
    const uid = user.id;
    const messages = data.messageCounts[uid] || 0;
    const voiceTime = Math.round(data.voiceDurations[uid] || 0);
    const h = Math.floor(voiceTime / 3600);
    const m = Math.floor((voiceTime % 3600) / 60);
    const s = Math.floor(voiceTime % 60);
    return message.channel.send(`${user.username} has sent ${messages} Messages and spent ${h}h ${m}m ${s}s in Voice-Chat.`);
  }

  if (command === 'help') {
    return message.channel.send(`📜 **Available Commands**\n- !mystats\n- !userstats @user\n- !help\n- !serverstats\n🔧 **Admin Commands**\n- !test\n- !resetstats @user\n- !topchatters\n- !topvoice\n- !lockbot\n- !createevent`);
  }

  if (command === 'test') {
    if (!isAdmin(message.member)) return message.channel.send('No permission.');
    return message.channel.send('✅ Bot test passed.');
  }

  if (command === 'resetstats') {
    if (!isAdmin(message.member)) return message.channel.send('No permission.');
    const user = message.mentions.users.first();
    if (!user) return message.channel.send('Please mention a user.');
    delete data.messageCounts[user.id];
    delete data.voiceDurations[user.id];
    delete data.voiceTimes[user.id];
    saveData();
    return message.channel.send(`Stats from ${user.username} have been reset.`);
  }

  if (command === 'topchatters') {
    if (!isAdmin(message.member)) return message.channel.send('No permission.');
    const sorted = Object.entries(data.messageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let text = '**Top 5 Chatters:**\n';
    for (const [uid, count] of sorted) {
      const member = await message.guild.members.fetch(uid).catch(() => null);
      text += `${member?.user?.username || 'Unknown'}: ${count} Messages\n`;
    }
    return message.channel.send(text);
  }

  if (command === 'topvoice') {
    if (!isAdmin(message.member)) return message.channel.send('No permission.');
    const sorted = Object.entries(data.voiceDurations).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let text = '**Top 5 Voice Chat Users:**\n';
    for (const [uid, seconds] of sorted) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const member = await message.guild.members.fetch(uid).catch(() => null);
      text += `${member?.user?.username || 'Unknown'}: ${h}h ${m}m ${s}s\n`;
    }
    return message.channel.send(text);
  }

  if (command === 'lockbot') {
    if (!isAdmin(message.member)) return message.channel.send('No permission.');
    data.locked = !data.locked;
    saveData();
    return message.channel.send(`🔒 Bot is now ${data.locked ? 'locked' : 'unlocked'}.`);
  }

if (command === 'createevent') {
  if (!isAdmin(message.member)) return message.channel.send('No permission to create events.');

  // Speichere die Guild ID schon jetzt, damit wir später wissen, wo das Event gepostet wird
  data.tempEvents[message.author.id] = { guildId: message.guild.id };
  saveData();

  const embed = new EmbedBuilder()
    .setTitle('📅 Event-Hosting')
    .setDescription('Click on the Button to host a new Event.')
    .setColor(0x00AEFF);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('start_event_modal')
      .setLabel('Host Event')
      .setStyle(ButtonStyle.Primary)
  );

  try {
    await message.author.send({ embeds: [embed], components: [button] });
    await message.channel.send('📬 Ive sent you a DM to host the Event.');
  } catch (err) {
    return message.channel.send('❌ Couldnt send you a DM please check your Privacy Settings');
  }
}
});

client.on('interactionCreate', async (interaction) => {
  // Button-Klick zum Öffnen des Event-Modals
  if (interaction.isButton() && interaction.customId === 'start_event_modal') {
    const modal = new ModalBuilder()
      .setCustomId('event_modal')
      .setTitle('Create New Event');

    const titleInput = new TextInputBuilder()
      .setCustomId('event_title')
      .setLabel('Event Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('event_desc')
      .setLabel('Event Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const dateInput = new TextInputBuilder()
      .setCustomId('event_date')
      .setLabel('Event Date (z.B. 2025-06-25)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(descInput);
    const thirdRow = new ActionRowBuilder().addComponents(dateInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);
    return;
  }

  // Modal wurde abgesendet
  if (interaction.isModalSubmit() && interaction.customId === 'event_modal') {
    const title = interaction.fields.getTextInputValue('event_title');
    const desc = interaction.fields.getTextInputValue('event_desc');
    const date = interaction.fields.getTextInputValue('event_date');

    data.tempEvents[interaction.user.id] = {
      ...data.tempEvents[interaction.user.id],
      title,
      desc,
      date,
    };
    saveData();

    const timeSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('event_time_select')
        .setPlaceholder('Choose time')
        .addOptions(
          ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(t => ({
            label: `${t} Uhr`,
            value: t,
          }))
        )
    );

    await interaction.reply({ content: '✅ Please choose a time for the Event:', components: [timeSelect], ephemeral: true });
    return;
  }

  // Zeit wurde gewählt
  if (interaction.isStringSelectMenu() && interaction.customId === 'event_time_select') {
    const userId = interaction.user.id;
    const time = interaction.values[0];
    const eventData = data.tempEvents[userId];
    if (!eventData) return interaction.reply({ content: '❌ Error loading the Event.', ephemeral: true });

    const guild = client.guilds.cache.get(eventData.guildId);
    if (!guild) return interaction.reply({ content: '❌ Server nicht gefunden.', ephemeral: true });

    const eventsChannel = guild.channels.cache.find(c => c.name === 'events' && c.type === ChannelType.GuildText);
    if (!eventsChannel) return interaction.reply({ content: '❌ Event-Channel nicht gefunden.', ephemeral: true });

    const eventEmbed = new EmbedBuilder()
      .setTitle(eventData.title)
      .setDescription(`${eventData.desc}\n\n📅 **${eventData.date}** um **${time} Uhr**\n👤 Hosted by ${interaction.user.username}`)
      .setColor(0x00ff99)
      .setTimestamp();

    data.events.push({
      title: eventData.title,
      desc: eventData.desc,
      date: eventData.date,
      time,
      by: interaction.user.username,
      timestamp: Date.now(),
    });
    delete data.tempEvents[userId];
    saveData();

    await eventsChannel.send({ content: `📢 @everyone`, embeds: [eventEmbed] });
    await interaction.update({ content: '✅ Dein Event wurde im #events-Channel erstellt!', components: [] });
  }
});
