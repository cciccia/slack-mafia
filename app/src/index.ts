import { getEdn } from './utils';
import { setDefaultSetup } from './game/gamestate';
import bot from './comm/bot';

const fs = require('fs');
const edn = getEdn();

console.log(`Running enviroment ${process.env.NODE_ENV}. Hello world.`);

bot.on('open', function() {
    setDefaultSetup();
    bot.postPublicMessage('I am now accepting commands.');
});

