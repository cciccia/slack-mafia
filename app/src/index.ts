import { getEdn } from './utils';
import { init } from './game/gamestate';
import { listSetups } from './game/setup';
import bot from './comm/bot';

import app from './server';

import * as http from 'http';

console.log(`Running enviroment ${process.env.NODE_ENV}`);

bot.on('open', function() {
    bot.postPublicMessage('Welcome to Mafia.');
});

const server = http.createServer(app);
server.listen(3000);
server.on('listening', () => {
    console.log('Express is listening on port 3000.');
});

init();