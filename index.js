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

const CONFIG_FILE = 'config.json';
let config;

try {
    config = require('./' + CONFIG_FILE);
} catch (err) {
    config = {
        serverIp: "",
        gameType: "minecraft",
        channelId: "",
        messageId: ""
    };
}
let onlineSince = null;

// Helper to save config
function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Start the update loop
    updateStatus();
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Command: !setup <ip> [type]
    if (message.content.startsWith('!setup')) {
        const args = message.content.split(' ');
        const ip = args[1];
        const type = args[2] || 'minecraft'; // Default to minecraft

        if (!ip) {
            return message.reply('Usage: !setup <server_ip> [game_type]\nExample: !setup play.hypixel.net minecraft');
        }

        // Send a placeholder message that we will edit later
        const statusEmbed = new EmbedBuilder()
            .setTitle('Server Status')
            .setDescription('Initializing...')
            .setColor(0xFFA500);

        const sentMessage = await message.channel.send({ embeds: [statusEmbed] });

        // Save configuration
        config.serverIp = ip;
        config.gameType = type;
        config.channelId = message.channel.id;
        config.messageId = sentMessage.id;
        saveConfig();

        message.reply(`Setup complete! Monitoring **${ip}** (${type}). Status will update every 1 second.`);
        
        // Trigger an immediate update
        updateStatus();
    }
});

async function updateStatus() {
    if (!config.serverIp || !config.channelId || !config.messageId) return;

    let host = config.serverIp;
    let port = undefined;

    // Handle IP:Port format
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
        
        if (port) {
            queryOptions.port = port;
        }

        // Add timeout options to make it faster/real-time
        queryOptions.maxAttempts = 1;
        queryOptions.socketTimeout = 2000;
        queryOptions.debug = false;

        const state = await GameDig.query(queryOptions);

        // Update onlineSince if it's the first time we see it online
        if (!onlineSince) {
            onlineSince = Date.now();
        }

        // Parse version if available
        let version = 'Unknown';
        if (state.raw && state.raw.vanilla && state.raw.vanilla.raw && state.raw.vanilla.raw.version) {
            version = state.raw.vanilla.raw.version.name;
        }

        // Ping Indicator
        let pingIcon = '🟢';
        if (state.ping > 100) pingIcon = '🟡';
        if (state.ping > 200) pingIcon = '🔴';

        // Online Status
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
                `> **⏳ Uptime Session:** <t:${Math.floor(onlineSince / 1000)}:R>\n` +
                `> **🕒 Local Server Time:** <t:${Math.floor(Date.now() / 1000)}:T>\n` +
                `> **📅 Last Updated:** <t:${Math.floor(Date.now() / 1000)}:R>`
            )
            .addFields(
                { name: '👥 **Online Players**', value: `\`\`\`${state.players.length} / ${state.maxplayers} Players\`\`\``, inline: true },
                { name: '📶 **Network Ping**', value: `\`\`\`${pingIcon} ${state.ping} ms\`\`\``, inline: true },
                { name: '🔧 **Server Version**', value: `\`\`\`${version}\`\`\``, inline: true }
            )
            .setImage('https://share.creavite.co/67876a8d563539e60228498d.gif')
            .setColor(0x57F287) // Discord Green
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Live Monitoring System • Updates every 1 second`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // Optional: List players if there are any (and not too many)
        if (state.players.length > 0) {
            const playerNames = state.players.map(p => p.name).filter(n => n).join(', ');
            if (playerNames.length < 1000 && playerNames.length > 0) {
                 embed.addFields({ name: '📜 **Online Players**', value: `\`\`\`${playerNames}\`\`\``, inline: false });
            }
        }

        editMessage(embed);

    } catch (error) {
        // Reset uptime if offline
        onlineSince = null;

        // Offline Status
        const embed = new EmbedBuilder()
            .setTitle(`${config.serverIp}`)
            .setDescription(
                `# 🔴 **OFFLINE**\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `**The server is currently unreachable.**\n\n` +
                `**🛑 Last Seen:** <t:${Math.floor(Date.now() / 1000)}:R>`
            )
            .setColor(0xED4245) // Discord Red
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Updates every 1s • Status: Offline`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        
        editMessage(embed);
        console.error('Error querying server:', error.message);
    } finally {
        // Schedule next update
        setTimeout(updateStatus, 1000);
    }
}

async function editMessage(embed) {
    try {
        const channel = await client.channels.fetch(config.channelId);
        if (!channel) return;
        
        const message = await channel.messages.fetch(config.messageId);
        if (!message) return;

        await message.edit({ embeds: [embed] });
    } catch (err) {
        console.error('Failed to edit message:', err.message);
    }
}

client.login(process.env.DISCORD_TOKEN);
