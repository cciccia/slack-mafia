import { slackMockForUsers } from './shared/slackMock';

const { slackMock, addCustomResponses, clients } = slackMockForUsers(7);

import { suite, test, slow, timeout } from "mocha-typescript";
import * as chai from 'chai';
const should = chai.should();
import * as Promise from 'bluebird';

import * as gamestate from '../src/game/gamestate';
import * as constants from '../src/constants';
import * as utils from '../src/utils';
import bot from '../src/comm/bot';

const edn = utils.getEdn();

function buildChatCall(id, text) {
    return {
        url: `${process.env.SLACK_API_URL}/chat.postMessage`,
        params: {
            text,
            channel: id,
            username: process.env.SLACK_BOT_DESCRIPTION,
            token: process.env.SLACK_BOT_TOKEN
        }
    };
}

function buildGroupCreateCall(name) {
    return {
        url: `${process.env.SLACK_API_URL}/groups.create`,
        params: {
            name,
            token: process.env.SLACK_API_TOKEN,
            validate: 'false'
        }
    };
}

function buildGroupInviteCall(id, channelId) {
    return {
        url: `${process.env.SLACK_API_URL}/groups.invite`,
        params: {
            user: id,
            channel: channelId,
            token: process.env.SLACK_API_TOKEN
        }
    };
}

function performTimedCommands(commands) {
    const promises = [];

    return Promise.all(commands.map(([client, command, params], i) =>
        Promise.delay(50 * i).then(() => client.doSlashCommand(command, params))));
}

@suite(slow(1000)) class Game {
    static before() {
        return require('./shared/server');
    }

    before() {
        gamestate.reset();
        slackMock.reset();
        addCustomResponses();
    }

    @test setSetup() {
        return clients[0].doSlashCommand('/setup', 'boring')
            .then(() => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls;

                const setup = gamestate.getCurrentSetup();
                should.exist(setup);
                setup.should.eql(edn.parse(['{:name "Boring 3p"',
                    ':tag "boring"',
                    ':slots [{:name "Vanilla Townie" :alignment #sm/enum :alignment/town :abilities []}',
                    '{:name "Vanilla Townie" :alignment #sm/enum :alignment/town :abilities []}',
                    '{:name "Mafia Goon" :alignment #sm/enum :alignment/mafia :abilities []}]',
                    ':has-day-talk false}'
                ].join('\n')).jsEncode());
            })
            .catch(e => { throw e; });
    }

    @test joinAndStart() {
        return clients[0].doSlashCommand('/setup', 'bird')
            .then(() => {
                return Promise.all(clients.map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls;

                const players = Array.from(gamestate.getPlayers().entries());
                players.map(player => player[0]).should.not.eql(clients.map(client => client.id));

                const town = players.filter(([id, slot]) => slot.alignment === constants.Alignment.Town);
                const mafia = players.filter(([id, slot]) => slot.alignment === constants.Alignment.Mafia);
                const cop = town.find(([id, slot]) => slot.name === 'Town Macho Cop');
                const doctor = town.find(([id, slot]) => slot.name === 'Town Doctor');
                const vanilla = town.filter(([id, slot]) => id !== cop[0] && id !== doctor[0]);

                players.forEach(player => {
                    const channelId = bot.ims.find(im => im.user === player[0]).id;

                    wCalls.should.deep.contain(buildChatCall(channelId, `Your role is: ${player[1].name}.`));
                });

                wCalls.should.deep.contain(buildGroupCreateCall(`Mafia-${gamestate.getGameId()}`));

                const factionChannels = gamestate.getFactionChannels();

                mafia.forEach(mafioso => {
                    wCalls.should.deep.contain(buildGroupInviteCall(
                        mafioso[0],
                        factionChannels.get(constants.Alignment.Mafia)
                    ));
                });

                wCalls.should.deep.contain(buildChatCall(bot.channels[0].id, `It is now Day 1.`));
            });
    }

    @test votes() {
        return clients[0].doSlashCommand('/setup', 'bird')
            .then(() => {
                return Promise.all(clients.map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                return performTimedCommands([
                    [clients[0], '/vote', clients[6].name],
                    [clients[1], '/vote', clients[6].name],
                    [clients[2], '/vote', clients[6].name],
                    [clients[3], '/vc']
                ]);
            })
            .then(result => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));

                wCalls.slice(-1)[0].should.eql(buildChatCall(bot.channels[0].id, [
                    'Votecount:',
                    `[3] ${clients[6].name}: (${clients[0].name}, ${clients[1].name}, ${clients[2].name})`,
                    `[4] Not Voting: (${clients[3].name}, ${clients[4].name}, ${clients[5].name}, ${clients[6].name})`,
                    '',
                    `With 7 alive, it is 4 to lynch.`
                ].join('\n')));

                return performTimedCommands([
                    [clients[1], '/unvote'],
                    [clients[5], '/vote', clients[3].name],
                    [clients[2], '/vote', clients[3].name],
                    [clients[4], '/vc']
                ]);
            })
            .then(() => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                wCalls.slice(-1)[0].should.eql(buildChatCall(bot.channels[0].id, [
                    'Votecount:',
                    `[2] ${clients[3].name}: (${clients[5].name}, ${clients[2].name})`,
                    `[1] ${clients[6].name}: (${clients[0].name})`,
                    `[4] Not Voting: (${clients[3].name}, ${clients[4].name}, ${clients[6].name}, ${clients[1].name})`,
                    '',
                    `With 7 alive, it is 4 to lynch.`
                ].join('\n')));
            });
    }

    @test lynchScene() {
        return clients[0].doSlashCommand('/setup', 'bird')
            .then(() => {
                return Promise.all(clients.map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                return performTimedCommands([
                    [clients[0], '/vote', clients[6].name],
                    [clients[1], '/vote', clients[6].name],
                    [clients[2], '/vote', clients[6].name],
                    [clients[3], '/vote', clients[6].name]
                ]);
            })
            .then(() => {
                const players = gamestate.getPlayers();
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));

                wCalls.slice(-1)[0].should.eql(buildChatCall(bot.channels[0].id, [
                    `${clients[6].name} was lynched. They were a ${players.get(clients[6].id).name}.`,
                    `It is now Night 1. Night will last 5 minutes.`
                ].join('\n')));
            });
    }

    @test factionalActionReporting() {
        return clients[0].doSlashCommand('/setup', 'bird')
            .then(() => {
                return Promise.all(clients.map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const players = gamestate.getPlayers();
                const [mafiaA, mafiaB] = clients.filter(client => players.get(client.id).alignment === constants.Alignment.Mafia);
                const town = clients.filter(client => players.get(client.id).alignment === constants.Alignment.Town);

                return performTimedCommands([
                    [clients[0], '/vote', town[4].name],
                    [clients[1], '/vote', town[4].name],
                    [clients[2], '/vote', town[4].name],
                    [clients[3], '/vote', town[4].name]
                ]);
            })
            .then(() => {
                const players = gamestate.getPlayers();
                const [mafiaA, mafiaB] = clients.filter(client => players.get(client.id).alignment === constants.Alignment.Mafia);
                const town = clients.filter(client => players.get(client.id).alignment === constants.Alignment.Town);

                return performTimedCommands([
                    [mafiaA, '/act', `kill ${town[0].name}`],
                    [mafiaB, '/act', `kill ${town[1].name}`]
                ]);
            })
            .then(() => {
                const players = gamestate.getPlayers();
                const [mafiaA, mafiaB] = clients.filter(client => players.get(client.id).alignment === constants.Alignment.Mafia);
                const town = clients.filter(client => players.get(client.id).alignment === constants.Alignment.Town);
                const sCalls = slackMock.slashCommands.calls;
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const factionChannels = gamestate.getFactionChannels();

                wCalls.slice(-1)[0].should.eql(buildChatCall(factionChannels.get(constants.Alignment.Mafia),
                    `${mafiaB.name} will kill ${town[1].name}`));

            });
    }
}