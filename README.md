# Discord Server Status Bot

This bot monitors a game server (like Minecraft, CS:GO, etc.) and updates a message in Discord every 10 seconds with the live status.

## Setup

1.  **Install Node.js**: Make sure you have Node.js installed.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Bot Token**:
    -   Open the `.env` file.
    -   Replace `your_bot_token_here` with your actual Discord Bot Token.
    -   (You can get a token from the [Discord Developer Portal](https://discord.com/developers/applications)).

4.  **Run the Bot**:
    ```bash
    node index.js
    ```

## Usage

In your Discord server, use the `!setup` command to start monitoring.

**Command:**
`!setup <server_ip> [game_type]`

**Examples:**
-   Monitor a Minecraft server:
    ```
    !setup play.hypixel.net
    ```
    (Default type is `minecraft`)

-   Monitor a specific Minecraft Bedrock server:
    ```
    !setup 123.45.67.89 minecraftbe
    ```

-   Monitor a CS:GO server:
    ```
    !setup 127.0.0.1 csgo
    ```

The bot will send a message and update it every 10 seconds.
