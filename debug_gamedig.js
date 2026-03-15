const { GameDig } = require('gamedig');

const ip = '148.113.24.119:23712';
let host = ip;
let port = undefined;

if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0];
    port = parseInt(parts[1]);
}

GameDig.query({
    type: 'minecraft',
    host: host,
    port: port
}).then((state) => {
    console.log(JSON.stringify(state, null, 2));
}).catch((error) => {
    console.error(error);
});
