const SlackBot = require('slackbots');

SlackBot.prototype.postPublicMessage = function(text, params, cb) {
    return this.postMessageToChannel(process.env.SLACK_GAME_CHANNEL, text, params, cb);
};

SlackBot.prototype.postMessageToUserById = function(id, text, params, cb) {
    return this.getUserById(id)
        .then(user => {
            return this.postMessageToUser(user.name, text, params, cb);
        });
};

const bot_token = process.env.SLACK_BOT_TOKEN || '';

const bot = new SlackBot({
    token: bot_token,
    name: process.env.SLACK_BOT_DESCRIPTION
});
bot.on('error', e => {
    console.error('Slack bot error: ', e);
});

export default bot;