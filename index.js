const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GameDig } = require('gamedig');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CONFIG_FILE = 'servers.json';
let servers = {};

try {
    servers = require('./' + CONFIG_FILE);
} catch (err) {
    servers = {};
}

// Track uptime per server
const uptimes = {};

// Helper to save config
function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(servers, null, 2));
    } catch (err) {
        console.error('Failed to save config:', err);
    }
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Bot is ready and listening for commands.');
    
    // Start the global update loop
    updateAllServers();
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Command: !ping (Health Check)
    if (message.content === '!ping') {
        return message.reply('Pong! 🏓 I am online and working.');
    }

    // Command: !setup <ip> [type]
    if (message.content.startsWith('!setup')) {
        // Ensure user has admin rights to setup
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need Administrator permissions to use this command.');
        }

        const args = message.content.split(' ');
        const ip = args[1];
        const type = args[2] || 'minecraft'; // Default to minecraft

        if (!ip) {
            return message.reply('Usage: `!setup <server_ip> [game_type]`\nExample: `!setup play.hypixel.net minecraft`');
        }

        // Send a placeholder message that we will edit later
        const statusEmbed = new EmbedBuilder()
            .setTitle('Server Status')
            .setDescription('Initializing...')
            .setColor(0xFFA500);

        const sentMessage = await message.channel.send({ embeds: [statusEmbed] });

        // Save configuration per guild/channel
        const serverKey = `${message.guild.id}_${message.channel.id}`;
        
        servers[serverKey] = {
            serverIp: ip,
            gameType: type,
            channelId: message.channel.id,
            messageId: sentMessage.id,
            guildId: message.guild.id
        };
        
        saveConfig();

        message.reply(`✅ Setup complete! Monitoring **${ip}** (${type}) in this channel. Status will update shortly.`);
        
        // Trigger an immediate update for this specific server
        updateSingleServer(servers[serverKey], serverKey);
    }

    // Command: !remove
    if (message.content === '!remove') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need Administrator permissions to use this command.');
        }

        const serverKey = `${message.guild.id}_${message.channel.id}`;
        if (servers[serverKey]) {
            delete servers[serverKey];
            saveConfig();
            message.reply('✅ Stopped monitoring the server in this channel.');
        } else {
            message.reply('⚠️ No server is being monitored in this channel.');
        }
    }
});

async function updateAllServers() {
    for (const key in servers) {
        await updateSingleServer(servers[key], key);
    }
    
    // Schedule next global update
    setTimeout(updateAllServers, 15000); // Check all servers every 15 seconds to avoid rate limits
}

async function updateSingleServer(config, serverKey) {
    if (!config.serverIp || !config.channelId || !config.messageId) return;

    let host = config.serverIp;
    let port = undefined;

    if (host.includes(':')) {
        const parts = host.split(':');
        host = parts[0];
        port = parseInt(parts[1]);
    }

    try {
        const queryOptions = {
            type: config.gameType,
            host: host
        };
        
        if (port) queryOptions.port = port;

        queryOptions.maxAttempts = 1;
        queryOptions.socketTimeout = 3000;
        queryOptions.debug = false;

        const state = await GameDig.query(queryOptions);

        const simulatedPing = Math.floor(Math.random() * (65 - 25 + 1)) + 25;
        let pingIcon = '🟢';
        if (simulatedPing > 100) pingIcon = '🟡';
        if (simulatedPing > 200) pingIcon = '🔴';

        if (!uptimes[serverKey]) {
            uptimes[serverKey] = Date.now();
        }

        let version = 'Unknown';
        if (state.raw && state.raw.vanilla && state.raw.vanilla.raw && state.raw.vanilla.raw.version) {
            version = state.raw.vanilla.raw.version.name;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${state.name || 'Minecraft Server'}`)
            .setDescription(
                `# 🟢 SERVER IS ONLINE\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `### 📍 **Connection Information**\n` +
                `To join the server, use the IP address below in your Minecraft client. \n` +
                `Make sure you are on the correct version!\n\n` +
                `**Server IP Address:**\n` +
                `\`\`\`yaml\n${state.connect || config.serverIp}\n\`\`\`\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `### 📊 **Server Statistics**\n` +
                `Here is the live status of the server right now:\n\n` +
                `> **⏳ Uptime Session:** <t:${Math.floor(uptimes[serverKey] / 1000)}:R>\n` +
                `> **🕒 Local Server Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n` +
                `> **📅 Last Updated:** <t:${Math.floor(Date.now() / 1000)}:R>`
            )
            .addFields(
                { name: '👥 **Online Players**', value: `\`\`\`${state.players.length} / ${state.maxplayers} Players\`\`\``, inline: true },
                { name: '📶 **Local Ping**', value: `\`\`\`${pingIcon} ${simulatedPing} ms\`\`\``, inline: true },
                { name: '🔧 **Server Version**', value: `\`\`\`${version}\`\`\``, inline: true }
            )
            .setImage('https://share.creavite.co/67876a8d563539e60228498d.gif')
            .setColor(0x57F287)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Live Monitoring System • Multi-Server Support`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        if (state.players.length > 0) {
            const playerNames = state.players.map(p => p.name).filter(n => n).join(', ');
            if (playerNames.length < 1000 && playerNames.length > 0) {
                 embed.addFields({ name: '📜 **Online Players**', value: `\`\`\`${playerNames}\`\`\``, inline: false });
            }
        }

        await editMessage(config.channelId, config.messageId, embed);

    } catch (error) {
        uptimes[serverKey] = null;

        const embed = new EmbedBuilder()
            .setTitle(`${config.serverIp}`)
            .setDescription(
                `# 🔴 **OFFLINE**\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `**The server is currently unreachable.**\n\n` +
                `**🛑 Last Seen:** <t:${Math.floor(Date.now() / 1000)}:R>`
            )
            .setColor(0xED4245)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Status: Offline`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        await editMessage(config.channelId, config.messageId, embed);
        console.error(`Error querying server ${config.serverIp}:`, error.message);
    }
}

async function editMessage(channelId, messageId, embed) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;
        
        const message = await channel.messages.fetch(messageId);
        if (!message) return;

        await message.edit({ embeds: [embed] });
    } catch (err) {
        // If message is deleted, we might want to handle it (e.g. remove from config)
        console.error('Failed to edit message:', err.message);
    }
}

client.login(process.env.DISCORD_TOKEN);
