import { getEdn } from './utils';
import { reset } from './game/gamestate';
import { listSetups } from './game/setup';
import bot from './comm/bot';

import app from './server';
import logger from './logger';

import * as http from 'http';

logger.info(`Running enviroment ${process.env.NODE_ENV}`);

bot.on('open', function() {
    bot.postPublicMessage('Welcome to Mafia.');
});

const server = http.createServer(app);
server.listen(3000);
server.on('listening', () => {
    logger.info('Express is listening on port 3000.');
});

reset();