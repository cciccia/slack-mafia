import { getEdn } from './utils';
import { listSetups, getSetup } from './game/setup';

const fs = require('fs');
const edn = getEdn();

const SlackBot = require('slackbots');

const bot_token = process.env.SLACK_BOT_TOKEN || '';
const bot = new SlackBot({
    token: bot_token,
    name: 'Flaccid McDougal'
});

console.log(`Running enviroment ${process.env.NODE_ENV}. Hello world.`);

console.log(getSetup('bird').at(edn.kw(':slots')).at(6).at(edn.kw(':abilities')).at(0));

bot.on('start', function() {
    bot.postMessageToChannel(process.env.SLACK_GAME_CHANNEL, 'Beware: I live!');
});

