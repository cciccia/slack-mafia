const SlackBot = require('slackbots');

SlackBot.prototype.postMessage = function(text, params, cb) {
    return this.postMessageToChannel(process.env.SLACK_GAME_CHANNEL, text, params, cb);
};

const bot_token = process.env.SLACK_BOT_TOKEN || '';

const bot = new SlackBot({
    token: bot_token,
    name: process.env.SLACK_BOT_NAME
});

export default bot;