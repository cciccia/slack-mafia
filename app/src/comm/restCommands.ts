import * as Promise from 'bluebird';
import * as request from 'superagent-bluebird-promise';
import { AlignmentAttributesMap, Alignment, NOT_VOTING_NAME, NO_LYNCH_NAME } from '../constants';

let channelIdsToNames: Map<string, string> = new Map<string, string>();
let channelNamesToIds: Map<string, string> = new Map<string, string>();

let userIdsToNames: Map<string, string> = new Map<string, string>([
    [NOT_VOTING_NAME, NOT_VOTING_NAME],
    [NO_LYNCH_NAME, NO_LYNCH_NAME]
]);
let userNamesToIds: Map<string, string> = new Map<string, string>([
    [NOT_VOTING_NAME, NOT_VOTING_NAME],
    [NO_LYNCH_NAME, NO_LYNCH_NAME]
]);

function retrieveChannelList() {
    return request
        .post(`${process.env.SLACK_API_URL}/channels.list`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
            token: process.env.SLACK_API_TOKEN,
            exclude_members: true
        })
        .then(results => {
            results.body.channels.forEach(channel => {
                channelIdsToNames.set(channel.id, channel.name);
                channelNamesToIds.set(channel.name, channel.id);
            });
        });
}

function retrieveUserList() {
    return request
        .post(`${process.env.SLACK_API_URL}/users.list`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
            token: process.env.SLACK_API_TOKEN,
            presence: false
        })
        .then(results => {
            results.body.members.forEach(member => {
                userIdsToNames.set(member.id, member.name);
                userNamesToIds.set(member.name, member.id);
            });
        });
}

export function getChannelNameFromId(id: string): Promise<string> {
    if (channelIdsToNames.has(id)) {
        return Promise.resolve(channelIdsToNames.get(id));
    } else {
        return retrieveChannelList()
            .then(() => {
                return channelIdsToNames.get(id);
            });
    }
}

export function getChannelIdFromName(name: string): Promise<string> {
    if (channelNamesToIds.has(name)) {
        return Promise.resolve(channelNamesToIds.get(name));
    } else {
        return retrieveChannelList()
            .then(() => {
                return channelNamesToIds.get(name);
            });
    }
}

export function getUserNameFromId(id: string): Promise<string> {
    if (userIdsToNames.has(id)) {
        return Promise.resolve(userIdsToNames.get(id));
    } else {
        return retrieveUserList()
            .then(() => {
                return userIdsToNames.get(id);
            });
    }
}

export function getUserIdFromName(rawName: string): Promise<string> {
    const name = rawName.replace('@', '').toLowerCase();

    if (userNamesToIds.has(name)) {
        return Promise.resolve(userNamesToIds.get(name));
    } else {
        return retrieveUserList()
            .then(() => {
                return userNamesToIds.get(name);
            });
    }
}

export function getUserIdToNameMap(): Promise<Map<string, string>> {
    if (userIdsToNames) {
        return Promise.resolve(userIdsToNames);
    } else {
        return retrieveUserList()
            .then(() => {
                return userIdsToNames;
            });
    }
}

export function getUserNameToIdMap(): Promise<Map<string, string>> {
    if (userNamesToIds) {
        return Promise.resolve(userNamesToIds);
    } else {
        return retrieveUserList()
            .then(() => {
                return userNamesToIds;
            });
    }
}

export function postPublicMessage(text: string): Promise<any> {
    return postMessage(`#${process.env.SLACK_GAME_CHANNEL}`, text);
}

export function postMessage(channelId: string, text: string): Promise<any> {
    return request
        .post(`${process.env.SLACK_API_URL}/chat.postMessage`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
            token: process.env.SLACK_API_TOKEN,
            channel: channelId,
            as_user: false,
            text
        });
}

export function createPrivateChannel(name: string, users: string[], alignment: Alignment) {
    return request
        .post(`${process.env.SLACK_API_URL}/groups.create`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
            token: process.env.SLACK_API_TOKEN,
            name,
            validate: false
        })
        .then(response => {
            channelIdsToNames.set(response.body.group.id, name);
            channelNamesToIds.set(name, response.body.group.id);

            return Promise.all(users.map(user => request
                .post(`${process.env.SLACK_API_URL}/groups.invite`)
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                    token: process.env.SLACK_API_TOKEN,
                    channel: response.body.group.id,
                    user
                })))
                .then(() => {
                    return response.body.group.id;
                });

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