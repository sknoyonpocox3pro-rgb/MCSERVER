const { GameDig } = require('gamedig');

const ip = '148.113.24.119:23712';
let host = ip;
let port = undefined;

if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0];
    port = parseInt(parts[1]);
}

console.log(`Querying Host: ${host}, Port: ${port}`);

GameDig.query({
    type: 'minecraft',
    host: host,
    port: port
}).then((state) => {
    console.log('Online!');
    console.log(state.name);
    console.log(`Players: ${state.players.length}/${state.maxplayers}`);
}).catch((error) => {
    console.log('Offline or Error:');
    console.log(error);
});
