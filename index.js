/**
 * Auteur: EXOBOT
 * Licence: MIT
 * Support Discord: https://discord.gg/3FeWMvWdna
 * Version: 1.1.3 Final
 * Date de sortie: 17 Novembre 2024
 */

'use strict';

require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ActivityType,
    ChannelType,
    MessageFlags
} = require('discord.js');
const fs = require('fs').promises;
const schedule = require('node-schedule');

// Configuration et initialisation
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    throw new Error("Les variables d'environnement DISCORD_TOKEN et CLIENT_ID sont obligatoires.");
}

// Configuration des intents nécessaires
const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites
];

// Configuration des paramètres REST
const restConfig = {
    timeout: 15000,
    retries: 3
};

// Initialisation du client avec les intents et la configuration REST
const client = new Client({
    intents: intents,
    rest: restConfig
});

const dataPath = './db.json';
let data = {};

// Fonctions utilitaires
async function loadData() {
    try {
        const fileContent = await fs.readFile(dataPath, 'utf8');
        data = fileContent.trim() ? JSON.parse(fileContent) : { servers: {}, reminders: {}, users: {} };
        Object.values(data.users).forEach(userData => userData.xp = userData.xp || 0);
    } catch (error) {
        console.error("Erreur lors du parsing du fichier JSON:", error);
        data = { servers: {}, reminders: {}, users: {} };
    }
}

async function saveData() {
    try {
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Erreur lors de l'écriture du fichier JSON:", error);
    }
}

// Fonction pour mettre à jour la présence
async function updatePresence(guild) {
    if (guild) delete data.servers[guild.id];
    await saveData();
    client.user.setActivity({ name: `${client.guilds.cache.size} serveurs`, type: ActivityType.Watching });
    client.user.setStatus('online');
}

// Commandes et gestion des interactions
const commands = [
    { name: 'bump', description: 'Envoyer un bump à tous les serveurs connectés.' },
    { name: 'ping_config', description: 'Activer ou désactiver le rappel pour bump.' },
    { name: 'bump_toggle', description: 'Activer ou désactiver le bot sur ce serveur (admin uniquement).' },
    { name: 'top_server', description: 'Voir les meilleurs serveurs bumpés.' },
    { name: 'bump_config', description: 'Configurer la description et le lien bannière (admin uniquement).' },
    { name: 'bump_set_channel', description: 'Définir le salon où les bumps doivent être envoyés (admin uniquement).' },
    { name: 'top_user', description: 'Voir les meilleurs utilisateurs bumpers.' },
    { name: 'bump_preview', description: 'Voir un aperçu du bump (admin uniquement).' },
    { name: 'stats_bump', description: 'Afficher les statistiques détaillées des bumps.' },
    { name: 'vote', description: 'Voter pour le serveur.' }
];

client.once("ready", async () => {
    console.log(`Bot connecté en tant que ${client.user.tag}!`);
    await loadData();
    updatePresence();
    schedule.scheduleJob('*/5 * * * *', updatePresence);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Déploiement des commandes...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Commandes enregistrées avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes :', error);
    }
    for (const guild of client.guilds.cache.values()) await createInviteIfNeeded(guild);
    schedule.scheduleJob('0 0 * * *', async () => {
        Object.values(data.servers).forEach(server => server.bumpCountToday = 0);
        await saveData();
        console.log('Les comptes de bumps quotidiens ont été réinitialisés.');
    });
    schedule.scheduleJob('0 0 * * 0', async () => {
        Object.values(data.servers).forEach(server => server.bumpCountWeek = 0);
        await saveData();
        console.log('Les comptes de bumps hebdomadaires ont été réinitialisés.');
    });
    schedule.scheduleJob('0 0 1 * *', async () => {
        Object.values(data.servers).forEach(server => {
            server.bumpCountMonth = 0;
            server.voteCount = 0;
        });
        await saveData();
        console.log('Les comptes de bumps mensuels et les votes ont été réinitialisés.');
    });
});

// Gestion des événements
client.on("guildCreate", async guild => {
    await createInviteIfNeeded(guild);
    updatePresence();
});

client.on("guildDelete", guild => {
    updatePresence(guild);
});

client.on("inviteDelete", async invite => {
    const guild = invite.guild;
    if (guild && data.servers[guild.id] && data.servers[guild.id].inviteLink === invite.url) {
        await createInviteIfNeeded(guild);
    }
});

// Rate limiter
const rateLimit = new Map();
const MAX_COMMANDS = 5;
const TIME_WINDOW = 60000;

function checkRateLimit(userId) {
    const now = Date.now();
    if (!rateLimit.has(userId)) {
        rateLimit.set(userId, [now]);
        return false;
    }
    const timestamps = rateLimit.get(userId);
    const filteredTimestamps = timestamps.filter(timestamp => now - timestamp < TIME_WINDOW);
    rateLimit.set(userId, [...filteredTimestamps, now]);
    return filteredTimestamps.length >= MAX_COMMANDS;
}

// Gestion des interactions
async function handleInteraction(interaction) {
    if (!interaction.isCommand() && !interaction.isModalSubmit()) return;
    const { commandName, guildId, user } = interaction;
    if (checkRateLimit(user.id)) {
        return interaction.reply({ content: '❌ Vous avez atteint la limite de commandes. Veuillez réessayer plus tard.', flags: [MessageFlags.Ephemeral] });
    }
    if (!data.servers[guildId]) {
        data.servers[guildId] = {
            enabled: true, bumpChannel: null, description: '', bannerLink: '', reminders: false,
            bumpCount: 0, bumpCountToday: 0, bumpCountWeek: 0, bumpCountMonth: 0, lastBump: 0,
            inviteLink: '', adViews: 0, voteCount: 0, lastVote: 0
        };
    }
    const serverData = data.servers[guildId];
    switch (commandName) {
        case 'bump': await handleBumpCommand(interaction, serverData, user, guildId); break;
        case 'ping_config': await handlePingConfigCommand(interaction, serverData); break;
        case 'bump_toggle': await handleBumpToggleCommand(interaction, serverData); break;
        case 'top_server': await handleTopServerCommand(interaction); break;
        case 'top_user': await handleTopUserCommand(interaction); break;
        case 'bump_config': await handleBumpConfigCommand(interaction, serverData); break;
        case 'bump_set_channel': await handleBumpSetChannelCommand(interaction, serverData, interaction.channel); break;
        case 'bump_preview': await handleBumpPreviewCommand(interaction, serverData, guildId); break;
        case 'stats_bump': await handleStatsBumpCommand(interaction); break;
        case 'vote': await handleVoteCommand(interaction, serverData, user, guildId); break;
        default: if (interaction.isModalSubmit() && interaction.customId === 'bumpConfigModal') await handleBumpConfigModalSubmit(interaction, serverData); break;
    }
}

client.on('interactionCreate', handleInteraction);

client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log("Le bot s'est connecté avec succès à Discord et est prêt à fonctionner.");
}).catch((error) => {
    console.error("Une erreur s'est produite lors de la tentative de connexion du bot à Discord.");
    console.error("Vérifiez que le jeton DISCORD_TOKEN est correct et configuré dans les variables d'environnement.");
    console.error("Détails de l'erreur :", error);
});

// Fonctions supplémentaires
async function createInviteIfNeeded(guild) {
    if (!data.servers[guild.id] || !data.servers[guild.id].inviteLink) {
        const me = guild.members.me;
        if (!me) {
            console.error(`Le bot n'est pas membre du serveur ${guild.name}.`);
            return;
        }
        const firstChannel = guild.channels.cache.find(channel =>
            channel.type === ChannelType.GuildText && channel.permissionsFor(me).has('CREATE_INSTANT_INVITE')
        );
        if (!firstChannel) {
            console.error(`Aucun canal de texte disponible pour créer une invitation sur le serveur ${guild.name}.`);
            return;
        }
        try {
            const invite = await guild.invites.create(firstChannel.id, { maxAge: 0, maxUses: 0 });
            data.servers[guild.id] = { ...data.servers[guild.id], inviteLink: invite.url, adViews: 0 };
            await saveData();
        } catch (error) {
            console.error(`Erreur lors de la création de l'invitation pour le serveur ${guild.name}:`, error);
        }
    }
}

const XP_PER_BUMP = 10;
const LEVEL_UP_XP = 1000;

function calculateLevel(xp) {
    return Math.floor(xp / LEVEL_UP_XP);
}

function calculateXPForNextLevel(xp) {
    return LEVEL_UP_XP - (xp % LEVEL_UP_XP);
}

const bumpQueue = [];
const MAX_CONCURRENT_BUMPS = 5;
let currentBumps = 0;
let queueEmbedMessage = null;

async function handleBumpCommand(interaction, serverData, user, guildId) {
    if (!serverData.bumpChannel) {
        return interaction.reply({ content: ' ❌ Le salon de bump n\'est pas configuré.', flags: [MessageFlags.Ephemeral] });
    }
    const now = Date.now();
    const cooldown = 3600000;
    if (now - serverData.lastBump < cooldown) {
        const remainingTime = Math.ceil((cooldown - (now - serverData.lastBump)) / 60000);
        const remainingHours = Math.floor(remainingTime / 60);
        const remainingMinutes = remainingTime % 60;
        return interaction.reply({
            content: `❌ Vous devez attendre encore ${remainingHours} heures et ${remainingMinutes} minutes avant de pouvoir bump à nouveau.`,
            flags: [MessageFlags.Ephemeral]
        });
    }
    bumpQueue.push({ interaction, serverData, user, guildId, cooldown });
    processBumpQueue();
}

async function processBumpQueue() {
    if (currentBumps >= MAX_CONCURRENT_BUMPS || bumpQueue.length === 0) return;
    const { interaction, serverData, user, guildId, cooldown } = bumpQueue.shift();
    currentBumps++;
    try {
        await sendBump(interaction, serverData, user, guildId, cooldown);
    } finally {
        currentBumps--;
        processBumpQueue();
    }
}

async function sendBump(interaction, serverData, user, guildId, cooldown) {
    const now = Date.now();
    const guild = client.guilds.cache.get(guildId);
    let badge = '';
    let badgeEmoji = '';
    if (serverData.bumpCount >= 10 && serverData.bumpCount < 100) {
        badge = 'Débutant'; badgeEmoji = '🌱';
    } else if (serverData.bumpCount >= 100 && serverData.bumpCount < 1000) {
        badge = 'Promoteur'; badgeEmoji = '📢';
    } else if (serverData.bumpCount >= 1000 && serverData.bumpCount < 10000) {
        badge = 'Expert'; badgeEmoji = '🚀';
    } else if (serverData.bumpCount >= 10000 && serverData.bumpCount < 10010) {
        badge = 'Maître'; badgeEmoji = '👑';
    } else if (serverData.bumpCount >= 10100) {
        badge = 'Légende'; badgeEmoji = '🔱';
    }
    const maxBumps = 10100;
    const bumpForNextBadge = (serverData.bumpCount / maxBumps) * 100;
    const embed = new EmbedBuilder()
        .setTitle(`${guild.name} vient d'être bump !`)
        .setDescription(serverData.description || 'Aucune description fournie.')
        .setImage(serverData.bannerLink || null)
        .setFooter({ text: `Bump par ${user.tag} | Propulsé par Exobot`, iconURL: user.displayAvatarURL() })
        .setTimestamp()
        .setColor('#00AAFF');
    const serverIconURL = guild.iconURL();
    embed.setThumbnail(serverIconURL || null);
    if (badge) {
        embed.addFields({ name: '\u200B', value: '**----------**' });
        embed.addFields({ name: 'Badge du Serveur:', value: `${badgeEmoji} **${badge}**`, inline: true });
        embed.addFields({
            name: 'Évolution du Badge:',
            value: `🔄 **${bumpForNextBadge.toFixed(2)}%**\n${'🟩'.repeat(Math.floor(bumpForNextBadge / 10))}${'⬛'.repeat(10 - Math.floor(bumpForNextBadge / 10))}`,
            inline: false
        });
    }
    const bumpChannels = [];
    Object.entries(data.servers).forEach(([server_id, serverConfig]) => {
        if (serverConfig.bumpChannel) {
            const bumpGuild = client.guilds.cache.get(server_id);
            const bumpChannel = bumpGuild?.channels.cache.get(serverConfig.bumpChannel);
            if (bumpChannel && bumpChannel.permissionsFor(client.user).has('SEND_MESSAGES')) {
                bumpChannels.push(bumpChannel);
                serverConfig.adViews = (serverConfig.adViews || 0) + 1;
            }
        }
    });
    for (const bumpChannel of bumpChannels) bumpChannel.send({ embeds: [embed] });
    serverData.bumpCount = (serverData.bumpCount || 0) + 1;
    serverData.bumpCountToday = (serverData.bumpCountToday || 0) + 1;
    serverData.bumpCountWeek = (serverData.bumpCountWeek || 0) + 1;
    serverData.bumpCountMonth = (serverData.bumpCountMonth || 0) + 1;
    serverData.lastBump = now;
    if (!data.users[user.id]) data.users[user.id] = { bumpCount: 0, xp: 0, voteCount: 0 };
    data.users[user.id].bumpCount += 1;
    data.users[user.id].xp += XP_PER_BUMP;
    const newLevel = calculateLevel(data.users[user.id].xp);
    const xpForNextLevel = calculateXPForNextLevel(data.users[user.id].xp);
    await assignRoleBasedOnLevel(guild, user, newLevel);
    if (serverData.reminders) {
        data.reminders[guildId] = { userId: user.id, timestamp: now };
        schedule.scheduleJob(new Date(now + cooldown), async () => {
            const reminderEmbed = new EmbedBuilder()
                .setTitle('C’est l’heure du bump !')
                .setDescription("🎉 **Hey toi ! C'est l'heure de briller !** 🎉\n\nN’oublie pas de **bump ton serveur** pour rester au sommet du classement 🌟 ! Plus tu bumps, plus ton serveur rayonne 🌍✨ ! \n\n**Tape vite /bump et fais monter la hype ! 🚀🔥**")
                .setFooter({ text: `Notification rappel bump | Propulsé par Exobot`, iconURL: guild.iconURL() })
                .setTimestamp()
                .setColor('#FF6363');
            const bumpGuild = client.guilds.cache.get(guildId);
            const bumpChannel = bumpGuild?.channels.cache.get(serverData.bumpChannel);
            if (bumpChannel && bumpChannel.permissionsFor(client.user).has('SEND_MESSAGES')) {
                const serverIconURL = bumpGuild.iconURL();
                reminderEmbed.setThumbnail(serverIconURL || null);
                bumpChannel.send({ content: `<@${user.id}>`, embeds: [reminderEmbed] });
            }
        });
    }
    const responseEmbed = new EmbedBuilder()
        .setTitle('Bump réussi !')
        .setDescription(`✅ Le bump vient d’être envoyé avec succès !\nLe serveur a actuellement un total de **${serverData.bumpCount}** bump(s).\nN’oubliez pas que vous pouvez désactiver les rappels de bump en utilisant la commande /ping_config.\n\nVous avez gagné **${XP_PER_BUMP} XP** !\nNiveau actuel: **${newLevel}**\nXP pour le prochain niveau: **${xpForNextLevel}**`)
        .setImage('https://i.imgur.com/UJwz62B.gif')
        .setFooter({ text: `${guild.name} | Propulsé par Exobot`, iconURL: guild.iconURL() })
        .setTimestamp()
        .setColor('#00AAFF');
    interaction.reply({ embeds: [responseEmbed], flags: [MessageFlags.Ephemeral] });
    await saveData();
    updateQueueEmbed(serverData.bumpChannel);
}

async function updateQueueEmbed(channelId) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;
    const totalServers = Object.keys(data.servers).length;
    const totalBumps = Object.values(data.servers).reduce((acc, server) => acc + (server.bumpCount || 0), 0);
    const totalFailedBumps = Object.values(data.servers).reduce((acc, server) => acc + (server.failedBumps || 0), 0);
    const totalBumpsAndFailed = totalBumps + totalFailedBumps;
    const successPercentage = totalBumpsAndFailed > 0 ? ((totalBumps / totalBumpsAndFailed) * 100).toFixed(2) : 0;
    const failurePercentage = totalBumpsAndFailed > 0 ? ((totalFailedBumps / totalBumpsAndFailed) * 100).toFixed(2) : 0;
    let embed;
    if (bumpQueue.length > 0) {
        embed = new EmbedBuilder()
            .setDescription(`⏱️ Nombre dans la file d'attente: **${bumpQueue.length}**`)
            .setColor('#00AAFF');
    } else {
        embed = new EmbedBuilder()
            .setDescription(`
            ✅ Nombre d'envois réussis: **${successPercentage}%**
            ❌ Nombre d'envois échoués: **${failurePercentage}%**
            🌐 Nombre de serveurs: **${totalServers}**
            `)
            .setColor('#00AAFF');
    }
    if (queueEmbedMessage && queueEmbedMessage.channelId === channelId) {
        await queueEmbedMessage.edit({ embeds: [embed] });
    } else {
        queueEmbedMessage = await channel.send({ embeds: [embed] });
    }
}

async function assignRoleBasedOnLevel(guild, user, level) {
    const roleNames = ['Bumper Débutant', 'Bumper Confirmé', 'Maître des Bumps', 'Légende du Bump', 'Dieu du Bump'];
    const roleColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500'];
    for (let i = 0; i < roleNames.length; i++) {
        let role = guild.roles.cache.find(r => r.name === roleNames[i]);
        if (!role) {
            role = await guild.roles.create({
                name: roleNames[i],
                color: roleColors[i],
                reason: 'Création automatique de rôle pour le système de niveaux'
            });
        }
        if (i === level - 1) {
            await guild.members.cache.get(user.id).roles.add(role);
        } else {
            await guild.members.cache.get(user.id).roles.remove(role);
        }
    }
}

async function handlePingConfigCommand(interaction, serverData) {
    serverData.reminders = !serverData.reminders;
    await saveData();
    interaction.reply({
        content: `🕒 Les rappels sont maintenant ${serverData.reminders ? '✅ activés' : '❌ désactivés'}.`,
        flags: [MessageFlags.Ephemeral]
    });
}

async function handleBumpToggleCommand(interaction, serverData) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({
            content: '❌ Vous devez être administrateur pour utiliser cette commande.',
            flags: [MessageFlags.Ephemeral]
        });
    }
    serverData.enabled = !serverData.enabled;
    await saveData();
    interaction.reply({
        content: `🤖 Le bot est maintenant ${serverData.enabled ? '✅ activé' : '❌ désactivé'}.`,
        flags: [MessageFlags.Ephemeral]
    });
}

async function handleTopServerCommand(interaction) {
    const totalAdViews = Object.values(data.servers).reduce((acc, serverConfig) => acc + (serverConfig.adViews || 0), 0);
    const topServers = Object.entries(data.servers)
        .filter(([serverId, serverConfig]) => !isNaN(serverConfig.bumpCount) && !isNaN(serverConfig.voteCount))
        .sort((a, b) => (b[1].bumpCount || 0) + (b[1].voteCount || 0) - (a[1].bumpCount || 0) + (a[1].voteCount || 0))
        .slice(0, 10)
        .map(([serverId, serverConfig], index) => {
            const guild = client.guilds.cache.get(serverId);
            const memberCount = guild ? guild.memberCount : 'N/A';
            const inviteLink = serverConfig.inviteLink || '#';
            const reputation = totalAdViews > 0 ? ((serverConfig.adViews / totalAdViews) * 100).toFixed(2) : 0;
            return `${index + 1}. **${guild?.name || 'Serveur inconnu'}**\nID du serveur: ${serverId}\nUtilisateurs: **${memberCount}**\nBump(s): **${serverConfig.bumpCount || 0}**\nVote(s): **${serverConfig.voteCount || 0}**\nRéputation: **${reputation}%**\n[Rejoindre le serveur](${inviteLink})`;
        })
        .join('\n\n');
    const embed = new EmbedBuilder()
        .setTitle('🏆 Top 10 Meilleurs Serveurs')
        .setDescription(topServers || 'Aucun serveur n\'a encore été bumpé ou voté.')
        .setTimestamp()
        .setColor('#FFD700');
    interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
}

async function handleTopUserCommand(interaction) {
    if (!data.users) data.users = {};
    const topUsers = Object.entries(data.users)
        .map(([userId, userData]) => {
            const totalBumps = userData.bumpCount || 0;
            const xp = userData.xp || 0;
            const level = calculateLevel(xp);
            const totalVotes = userData.voteCount || 0;
            return [userId, totalBumps, xp, level, totalVotes];
        })
        .filter(([userId, totalBumps]) => !isNaN(totalBumps))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, totalBumps, xp, level, totalVotes], index) => {
            const user = client.users.cache.get(userId);
            return `${index + 1}. **${user?.tag || 'Utilisateur inconnu'}**\nID de l'utilisateur: ${userId}\nBump(s): **${totalBumps}**\nVote(s): **${totalVotes}**\nXP: **${xp}**\nNiveau: **${level}**\n[Voir le profil](discord://-/users/${userId})`;
        })
        .join('\n\n');
    const embed = new EmbedBuilder()
        .setTitle('🏆 Top 10 Meilleurs Utilisateurs')
        .setDescription(topUsers || 'Aucun utilisateur n\'a encore bumpé.')
        .setTimestamp()
        .setColor('#FFD700');
    interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
}

async function handleBumpConfigCommand(interaction, serverData) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({
            content: '❌ Vous devez être administrateur pour utiliser cette commande.',
            flags: [MessageFlags.Ephemeral]
        });
    }
    const modal = new ModalBuilder()
        .setCustomId('bumpConfigModal')
        .setTitle('Configurer le Bump');
    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel("Description du bump")
        .setPlaceholder("Insérez la description du bump")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true);
    const bannerInput = new TextInputBuilder()
        .setCustomId('banner')
        .setLabel('Lien de la bannière (optionnel)')
        .setPlaceholder("Insérez le lien de l'image de bannière (optionnel)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
    const row1 = new ActionRowBuilder().addComponents(descriptionInput);
    const row2 = new ActionRowBuilder().addComponents(bannerInput);
    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
}

async function handleBumpConfigModalSubmit(interaction, serverData) {
    const description = interaction.fields.getTextInputValue('description').trim();
    const bannerLink = interaction.fields.getTextInputValue('banner').trim();
    if (description.length > 2000) {
        return interaction.reply({ content: '❌ La description est trop longue.', flags: [MessageFlags.Ephemeral] });
    }
    if (bannerLink && !/^https?:\/\/.+/.test(bannerLink)) {
        return interaction.reply({ content: '❌ Le lien de la bannière n\'est pas valide.', flags: [MessageFlags.Ephemeral] });
    }
    serverData.description = description;
    serverData.bannerLink = bannerLink;
    await saveData();
    interaction.reply({ content: '✅ Configuration mise à jour avec succès.', flags: [MessageFlags.Ephemeral] });
}

async function handleBumpSetChannelCommand(interaction, serverData, channel) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({
            content: '❌ Vous devez être administrateur pour utiliser cette commande.',
            flags: [MessageFlags.Ephemeral]
        });
    }
    serverData.bumpChannel = channel.id;
    await saveData();
    interaction.reply({ content: '✅ Salon de bump configuré avec succès.', flags: [MessageFlags.Ephemeral] });
    updateQueueEmbed(channel.id);
}

async function handleBumpPreviewCommand(interaction, serverData, guildId) {
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({
            content: '❌ Vous devez être administrateur pour utiliser cette commande.',
            flags: [MessageFlags.Ephemeral]
        });
    }
    const guild = client.guilds.cache.get(guildId);
    const embed = new EmbedBuilder()
        .setTitle(`Prévisualisation du bump pour ${guild.name}`)
        .setDescription(serverData.description || 'Aucune description fournie.')
        .setImage(serverData.bannerLink || null)
        .setFooter({ text: `Prévisualisation du bump | Propulsé par Exobot`, iconURL: guild.iconURL() })
        .setTimestamp()
        .setColor('#7289DA');
    const serverIconURL = guild.iconURL();
    embed.setThumbnail(serverIconURL || null);
    interaction.reply({ content: '✨ Découvrez un aperçu du bump :', embeds: [embed], flags: [MessageFlags.Ephemeral] });
}

async function handleStatsBumpCommand(interaction) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    const stats = {
        totalBumps: 0, totalBumpsToday: 0, totalBumpsWeek: 0, totalBumpsMonth: 0, totalAdViews: 0, totalVotes: 0, serverCount: 0
    };
    Object.values(data.servers).forEach(server => {
        if (server.bumpCount > 0) {
            stats.serverCount++;
            stats.totalBumps += server.bumpCount || 0;
            stats.totalAdViews += server.adViews || 0;
            stats.totalVotes += server.voteCount || 0;
            if (server.lastBump) {
                const timeDiff = now - server.lastBump;
                if (timeDiff <= oneDay) stats.totalBumpsToday += server.bumpCountToday || 0;
                if (timeDiff <= oneWeek) stats.totalBumpsWeek += server.bumpCountWeek || 0;
                if (timeDiff <= oneMonth) stats.totalBumpsMonth += server.bumpCountMonth || 0;
            }
        }
    });
    const averageBumps = stats.serverCount > 0 ? (stats.totalBumps / stats.serverCount).toFixed(2) : "0.00";
    const embed = new EmbedBuilder()
        .setTitle('📈 Statistiques Détaillées des Bumps')
        .setDescription(`
        **Statistiques Globales:**
        Serveurs actifs: **${stats.serverCount.toLocaleString()}**
        Total des bumps: **${stats.totalBumps.toLocaleString()}**
        Total des votes: **${stats.totalVotes.toLocaleString()}**
        Total des vues publicitaires: **${stats.totalAdViews.toLocaleString()}**

        **Activité Récente:**
        Bumps aujourd'hui: **${stats.totalBumpsToday.toLocaleString()}**
        Bumps cette semaine: **${stats.totalBumpsWeek.toLocaleString()}**
        Bumps ce mois-ci: **${stats.totalBumpsMonth.toLocaleString()}**

        **Moyenne:**
        Moyenne de bumps par serveur: **${averageBumps}%**
        `)
        .setColor('#00AAFF')
        .setTimestamp();
    const activityBar = createActivityBar(stats);
    if (activityBar) embed.addFields({ name: 'Tendance d\'activité', value: activityBar, inline: false });
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
}

function createActivityBar(stats) {
    const maxValue = Math.max(stats.totalBumpsToday, stats.totalBumpsWeek / 7, stats.totalBumpsMonth / 30);
    if (maxValue === 0) return null;
    const todayPercent = (stats.totalBumpsToday / maxValue) * 10;
    const weekPercent = ((stats.totalBumpsWeek / 7) / maxValue) * 10;
    const monthPercent = ((stats.totalBumpsMonth / 30) / maxValue) * 10;
    return `Aujourd'hui: ${'🟦'.repeat(Math.round(todayPercent))}${'⬜'.repeat(10 - Math.round(todayPercent))}
Cette semaine: ${'🟩'.repeat(Math.round(weekPercent))}${'⬜'.repeat(10 - Math.round(weekPercent))}
Ce mois: ${'🟨'.repeat(Math.round(monthPercent))}${'⬜'.repeat(10 - Math.round(monthPercent))}`;
}

async function handleVoteCommand(interaction, serverData, user, guildId) {
    const now = Date.now();
    const cooldown = 86400000;
    if (now - (serverData.lastVote || 0) < cooldown) {
        const remainingTime = Math.ceil((cooldown - (now - (serverData.lastVote || 0))) / 60000);
        const remainingHours = Math.floor(remainingTime / 60);
        const remainingMinutes = remainingTime % 60;
        return interaction.reply({
            content: `❌ Vous devez attendre encore ${remainingHours} heures et ${remainingMinutes} minutes avant de pouvoir voter à nouveau.`,
            flags: [MessageFlags.Ephemeral]
        });
    }
    serverData.voteCount = (serverData.voteCount || 0) + 1;
    serverData.lastVote = now;
    if (!data.users[user.id]) data.users[user.id] = { bumpCount: 0, xp: 0, voteCount: 0 };
    data.users[user.id].voteCount += 1;
    const responseEmbed = new EmbedBuilder()
        .setTitle('Vote réussi !')
        .setDescription(`✅ Le vote vient d’être enregistré avec succès !\nLe serveur a actuellement un total de **${serverData.voteCount}** vote(s).`)
        .setImage('https://i.imgur.com/jF2XSG0.mp4')
        .setFooter({ text: `${interaction.guild.name} | Propulsé par Exobot`, iconURL: interaction.guild.iconURL() })
        .setTimestamp()
        .setColor('#00AAFF');
    interaction.reply({ embeds: [responseEmbed], flags: [MessageFlags.Ephemeral] });
    await saveData();
}
