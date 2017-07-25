import { getEdn } from './utils';
import { setDefaultSetup } from './game/gamestate';
import bot from './comm/bot';

import app from './server';

import * as http from 'http';

console.log(`Running enviroment ${process.env.NODE_ENV}`);

bot.on('open', function() {
    setDefaultSetup();
    bot.postPublicMessage('I am now accepting commands.');
});

const server = http.createServer(app);
server.listen(3000);
server.on('listening', () => {
    console.log('Express is listening on port 3000.');
});