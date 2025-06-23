const fs = require('fs');
const express = require('express');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  InteractionType,
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
  return member.roles.cache.some(
    (role) => role.name === 'Senator' || role.name === 'Technician🔧'
  );
}

const prefix = '!';

let activeEvents = new Map(); // messageId -> eventData { creatorId, messageId, date, title, description }
let tempEventData = new Map(); // userId -> { title, description, date?, time? }

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

// --- Voice State Tracking etc. ---
// (Dein bereits vorhandener Code hier für voiceStateUpdate, messageCreate etc. bleibt unverändert!)

// ----------------------------------------------------
// Unten: MessageCreate Event mit Event-Befehl & Interactions
// ----------------------------------------------------

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  // ... (Deine bereits vorhandenen Codeblöcke für Begrüßung, Nachrichtenzähler etc.)

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // Event erstellen - !createevent
  if (command === 'createevent') {
    // Modal: Titel & Beschreibung
    const modal = new ModalBuilder()
      .setCustomId('createEventModal')
      .setTitle('Event erstellen');

    const titleInput = new TextInputBuilder()
      .setCustomId('eventTitle')
      .setLabel('Event Titel')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setPlaceholder('Gib den Event-Titel ein')
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('eventDescription')
      .setLabel('Event Beschreibung')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(300)
      .setPlaceholder('Gib eine Beschreibung für das Event ein')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    try {
      await message.author.send({ modals: [modal] });
      await message.reply(
        'Ich habe dir eine DM mit dem Event-Formular geschickt. Bitte überprüfe deinen Posteingang.'
      );
    } catch {
      await message.reply(
        'Ich konnte dir keine DM schicken. Bitte aktiviere deine DMs und versuche es erneut.'
      );
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  // Modal Submit für Event-Titel & Beschreibung
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'createEventModal') {
      const title = interaction.fields.getTextInputValue('eventTitle');
      const description = interaction.fields.getTextInputValue('eventDescription');

      // Dropdowns für Datum und Uhrzeit vorbereiten
      const dates = [
        { label: 'Heute', value: 'today' },
        { label: 'Morgen', value: 'tomorrow' },
        { label: 'Übermorgen', value: 'dayafter' },
      ];

      const times = [
        { label: '18:00 Uhr', value: '18:00' },
        { label: '20:00 Uhr', value: '20:00' },
        { label: '22:00 Uhr', value: '22:00' },
      ];

      const dateSelect = new StringSelectMenuBuilder()
        .setCustomId('selectDate')
        .setPlaceholder('Wähle ein Datum')
        .addOptions(dates);

      const timeSelect = new StringSelectMenuBuilder()
        .setCustomId('selectTime')
        .setPlaceholder('Wähle eine Uhrzeit')
        .addOptions(times);

      // Temporär speichern
      tempEventData.set(interaction.user.id, { title, description });

      await interaction.reply({
        content:
          'Bitte wähle zuerst das Datum und danach die Uhrzeit für dein Event aus.',
        components: [
          new ActionRowBuilder().addComponents(dateSelect),
          new ActionRowBuilder().addComponents(timeSelect),
        ],
        ephemeral: true,
      });
    }
  }

  // Dropdown Auswahl für Datum und Uhrzeit
  if (interaction.isStringSelectMenu()) {
    if (
      interaction.customId === 'selectDate' ||
      interaction.customId === 'selectTime'
    ) {
      const userId = interaction.user.id;
      if (!tempEventData.has(userId)) {
        return interaction.reply({
          content: 'Kein Event in Bearbeitung. Bitte starte mit !createevent.',
          ephemeral: true,
        });
      }

      const eventData = tempEventData.get(userId);

      if (interaction.customId === 'selectDate') {
        eventData.date = interaction.values[0];
        tempEventData.set(userId, eventData);
        return interaction.reply({
          content: `Datum gewählt: **${eventData.date}**. Bitte jetzt die Uhrzeit auswählen.`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'selectTime') {
        if (!eventData.date) {
          return interaction.reply({
            content: 'Bitte zuerst ein Datum auswählen.',
            ephemeral: true,
          });
        }
        eventData.time = interaction.values[0];

        // Embed im #events Channel posten
        const guild = interaction.guild;
        const eventsChannel = guild.channels.cache.find(
          (c) => c.name === 'events'
        );

        if (!eventsChannel) {
          return interaction.reply({
            content: 'Channel #events nicht gefunden.',
            ephemeral: true,
          });
        }

        // Datum berechnen
        let eventDateTime = new Date();
        if (eventData.date === 'tomorrow')
          eventDateTime.setDate(eventDateTime.getDate() + 1);
        else if (eventData.date === 'dayafter')
          eventDateTime.setDate(eventDateTime.getDate() + 2);
        // Uhrzeit parsen
        const [hours, minutes] = eventData.time.split(':').map(Number);
        eventDateTime.setHours(hours, minutes, 0, 0);

        const timestamp = Math.floor(eventDateTime.getTime() / 1000);

        const embed = new EmbedBuilder()
          .setTitle(eventData.title)
          .setDescription(eventData.description)
          .addFields(
            {
              name: 'Datum & Uhrzeit',
              value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`,
              inline: false,
            },
            { name: 'Erstellt von', value: `<@${userId}>`, inline: true }
          )
          .setColor(0x00ae86)
          .setFooter({ text: 'Event Management System' })
          .setTimestamp();

        const sentMessage = await eventsChannel.send({
          content: '@everyone Neues Event:',
          embeds: [embed],
        });

        // Speichern für spätere Bearbeitung
        activeEvents.set(sentMessage.id, {
          creatorId: userId,
          messageId: sentMessage.id,
          date: eventDateTime.toISOString(),
          title: eventData.title,
          description: eventData.description,
        });

        tempEventData.delete(userId);

        return interaction.reply({
          content: 'Event erstellt und im #events Channel gepostet!',
          ephemeral: true,
        });
      }
    }
  }
});
