const Promise = require('bluebird');
const request = require('superagent-bluebird-promise');

export function createPrivateChannel(name: string, users: string[]) {
    return request
        .post(`${process.env.SLACK_API_URL}/groups.create`)
        .send({
            token: process.env.SLACK_API_TOKEN,
            name,
            validate: false
        })
        .then(response => {
            return Promise.all(users.map(user => request
                .post(`${process.env.SLACK_API_URL}/groups.invite`)
                .send({
                    token: process.env.SLACK_API_TOKEN,
                    channel: response.id,
                    user
                })));
        });
}

export function lockPrivateChannel(channel: string) {
    return request
        .post(`${process.env.SLACK_API_URL}/groups.archive`)
        .send({
            token: process.env.SLACK_API_TOKEN,
            channel
        });
}

export function unlockPrivateChannel(channel: string) {
    return request
        .post(`${process.env.SLACK_API_URL}/groups.unarchive`)
        .send({
            token: process.env.SLACK_API_TOKEN,
            channel
        });
}