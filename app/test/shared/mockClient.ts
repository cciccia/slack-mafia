import * as shortId from 'shortid';
import * as Promise from 'bluebird';

import { slackMock } from './slackMock';

export function clientFactory(name: string): any {
    return {
        props: {
            token: process.env.SLACK_VERIFICATION_TOKEN,
            team_id: 'test',
            team_domain: 'test',
            enterprise_id: 'test',
            enterprise_name: 'test',
            channel_id: process.env.SLACK_GAME_CHANNEL,
            channel_name: process.env.SLACK_GAME_CHANNEL,
            user_id: shortId.generate(),
            user_name: name,
            response_url: ''
        },

        doSlashCommand: function(command, text) {
            const payload = Object.assign({ command, text }, this.props);
            return slackMock.slashCommands.send(`http://localhost:3000/api/v1/commands${command}`, payload)
                .then(result => Promise.delay(75))
                .catch(e => { throw e; });
        }
    }
}