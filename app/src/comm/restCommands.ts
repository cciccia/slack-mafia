import * as Promise from 'bluebird';
import * as request from 'superagent-bluebird-promise';

export function createPrivateChannel(name: string, users: string[]) {
    return request
        .post(`${process.env.SLACK_API_URL}/groups.create`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
            token: process.env.SLACK_API_TOKEN,
            name,
            validate: false
        })
        .then(response => {
            return Promise.all(users.map(user => request
                .post(`${process.env.SLACK_API_URL}/groups.invite`)
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                    token: process.env.SLACK_API_TOKEN,
                    channel: response.id,
                    user
                })))
                .then(() => response.id);
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