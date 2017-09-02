import * as shortId from 'shortid';
import * as Promise from 'bluebird';

const slackMock = require('slack-mock')({ rtmPort: 9001, logLevel: process.env.LOG_LEVEL });

export function slackMockForUsers(numUsers: number) {
    function clientFactory(name: string): any {
        const id = shortId.generate();

        return {
            id,
            name,

            props: {
                token: process.env.SLACK_VERIFICATION_TOKEN,
                team_id: 'test',
                team_domain: 'test',
                enterprise_id: 'test',
                enterprise_name: 'test',
                channel_id: process.env.SLACK_GAME_CHANNEL,
                channel_name: process.env.SLACK_GAME_CHANNEL,
                user_id: id,
                user_name: name,
                response_url: ''
            },

            doSlashCommand: function(command, text = '') {
                const payload = Object.assign({ command, text }, this.props);
                return slackMock.slashCommands.send(`http://localhost:3000/api/v1/commands${command}`, payload)
                    .then(result => Promise.delay(75))
                    .catch(e => { throw e; });
            }
        }
    }

    const clients = Array.from({ length: numUsers }, (value, key) => key).map(userNum => clientFactory(userNum.toString()));

    slackMock.web.addResponse({
        url: `${process.env.SLACK_API_URL}/rtm.start`,
        statusCode: 200,
        body: {
            ok: true,
            channels: [
                {
                    id: shortId.generate(),
                    name: process.env.SLACK_GAME_CHANNEL
                }
            ],
            users: clients.map(client => ({ id: client.id, name: client.name })),
            ims: clients.map(client => ({ id: shortId.generate(), user: client.id }))
        }
    });

    return {
        slackMock,
        clients
    };
}