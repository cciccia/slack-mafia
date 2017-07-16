import { getEdn } from './utils';
import { setDefaultSetup } from './game/gamestate';
import bot from './comm/bot';

const fs = require('fs');
const edn = getEdn();

console.log(`Running enviroment ${process.env.NODE_ENV}. Hello world.`);

bot.on('start', function() {
    setDefaultSetup();
    bot.postMessage('I am now accepting commands.');
});

