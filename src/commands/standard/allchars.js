const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const Character = require('../../controllers/character');
const Server = require('../../controllers/server');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allchars')
    .setDescription('Retrieve and display all characters in the clan'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const serverId = interaction.guild.id;

      const character = new Character(userId, '', '');

      const allCharactersPerUser = await character.getAllCharactersInServer(serverId, interaction);

      if (Object.keys(allCharactersPerUser).length === 0) {
        return interaction.reply('No character information found for any user.');
      }

      const charactersPerPage = 5;
      let currentPage = 0;
      let characterInfoMessage = '';
      const usernames = Object.keys(allCharactersPerUser);
      const totalPages = Math.ceil(usernames.length / charactersPerPage);

      const server = new Server(serverId);
      const customColor = await server.getCustomColor();

      const sendPage = async (page) => {
        currentPage = page;
        const start = page * charactersPerPage;
        const end = (page + 1) * charactersPerPage;

        characterInfoMessage = usernames
          .slice(start, end)
          .map((username) => {
            const userCharacters = allCharactersPerUser[username];
            const userCharacterInfo = [];

            for (const className in userCharacters) {
              if (userCharacters[className].length > 0) {
                userCharacterInfo.push(`**${className}**: ${userCharacters[className].map(character => character).join(', ')}`); // Access the IGN of the character
              }
            }

            return `**For ${username}**:\n${userCharacterInfo.join('\n')}`;
          })
          .join('\n\n');

        const embed = {
          title: `Character Information (Page ${page + 1}/${totalPages})`,
          description: characterInfoMessage,
          color: customColor ? parseInt(customColor.slice(1), 16) : 0xffffff, // Convert the hex color to an integer
        };

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('previous')
              .setLabel('Previous')
              .setStyle('Secondary')
              .setDisabled(page === 0 || userId !== interaction.user.id),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle('Secondary')
              .setDisabled(page === totalPages - 1 || userId !== interaction.user.id),
          );

        if (!interaction.replied) {
          interaction.reply({ embeds: [embed], components: [row] });
        } else {
          interaction.editReply({ embeds: [embed], components: [row] });
        }
      };

      const filter = (i) => i.customId === 'previous' || i.customId === 'next';
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'previous' && currentPage > 0) {
          await buttonInteraction.deferUpdate();
          sendPage(currentPage - 1);
        } else if (buttonInteraction.customId === 'next' && currentPage < totalPages - 1) {
          await buttonInteraction.deferUpdate();
          sendPage(currentPage + 1);
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          const embed = {
            title: `Character Information (Page ${currentPage + 1}/${totalPages})`,
            description: characterInfoMessage,
            color: customColor ? parseInt(customColor.slice(1), 16) : 0xffffff, // Convert the hex color to an integer
          };
          await interaction.editReply({ embeds: [embed], components: [] });
        }
      });

      sendPage(0);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  },
};
