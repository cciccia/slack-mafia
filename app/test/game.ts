import { slackMockForUsers } from './shared/slackMock';

const { slackMock, addCustomResponses, clients } = slackMockForUsers(7);

import { suite, test, slow, timeout } from "mocha-typescript";
import * as chai from 'chai';
const should = chai.should();
import * as Promise from 'bluebird';

import * as gamestate from '../src/game/gamestate';
import * as constants from '../src/constants';
import * as utils from '../src/utils';

const edn = utils.getEdn();

function buildChatCall(id, text) {
    return {
        url: `${process.env.SLACK_API_URL}/chat.postMessage`,
        params: {
            text,
            channel: id,
            as_user: 'false',
            token: process.env.SLACK_API_TOKEN
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

function getPlayersByRoleAndAlignment() {
    const players = gamestate.getState().playerSlots;

    const activeClients = clients.filter(client => players.has(client.id));

    const town = activeClients.filter(client => players.get(client.id).alignment === constants.Alignment.Town);
    const mafia = activeClients.filter(client => players.get(client.id).alignment === constants.Alignment.Mafia);
    const cop = town.find(client => players.get(client.id).name === 'Town Macho Cop');
    const doctor = town.find(client => players.get(client.id).name === 'Town Doctor');
    const vanilla = town.filter(client => (!cop || client.id !== cop.id) && (!doctor || client.id !== doctor.id));

    return {
        town, mafia, cop, doctor, vanilla
    };
}

@suite(slow(1000), timeout(10000)) class Game {
    static before() {
        return require('./shared/server');
    }

    before() {
        slackMock.reset();
        addCustomResponses(clients);
        gamestate.reset();
    }

    @test setSetup() {
        return clients[0].doSlashCommand('/setup', 'simple')
            .then(() => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls;

                const setup = gamestate.getState().currentSetup;
                should.exist(setup);
                setup.should.eql({
                    name: 'Simple 3p',
                    tag: 'simple',
                    slots: [
                        {name: "Vanilla Townie", alignment: constants.Alignment.Town, abilities: []},
                        {name: "Vanilla Townie", alignment: constants.Alignment.Town, abilities: []},
                        {name: "Mafia Goon", alignment: constants.Alignment.Mafia, abilities: []}
                    ]
                });
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

                const players = Array.from(gamestate.getState().playerSlots.entries());
                players.map(player => player[0]).should.not.eql(clients.map(client => client.id));

                const { mafia } = getPlayersByRoleAndAlignment();

                players.forEach(([playerId, player]) => {
                    const playerClient = clients.find(client => client.id === playerId);
                    wCalls.should.deep.contain(buildChatCall(`@${playerClient.name}`, `Your role is: ${player.name}.`));
                });

                wCalls.should.deep.contain(buildGroupCreateCall(`Mafia-${gamestate.getState().currentGameId}`));

                const factionChannels = gamestate.getState().factionChannels;

                mafia.forEach(mafioso => {
                    wCalls.should.deep.contain(buildGroupInviteCall(
                        mafioso.id,
                        factionChannels.get(constants.Alignment.Mafia)
                    ));
                });

                wCalls.should.deep.contain(buildChatCall(`#${process.env.SLACK_GAME_CHANNEL}`, `It is now Day 1.`));
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

                wCalls.slice(-1)[0].should.eql(buildChatCall(`#${process.env.SLACK_GAME_CHANNEL}`, [
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
                const sCalls = slackMock.slashCommands.calls;

                wCalls.slice(-1)[0].should.eql(buildChatCall(`#${process.env.SLACK_GAME_CHANNEL}`, [
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
                const players = gamestate.getState().playerSlots;
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));

                wCalls.slice(-1)[0].should.eql(buildChatCall(`#${process.env.SLACK_GAME_CHANNEL}`, [
                    `${clients[6].name} was lynched. They were a ${players.get(clients[6].id).name}.`,
                    `It is now Night 1. Night will last ${process.env.NIGHT_LENGTH} seconds.`
                ].join('\n')));
            });
    }

    @test factionalActionReporting() {
        return clients[0].doSlashCommand('/setup', 'bird')
            .then(() => {
                return Promise.all(clients.map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const players = gamestate.getState().playerSlots;
                const { town, mafia } = getPlayersByRoleAndAlignment();

                return performTimedCommands([
                    [clients[0], '/vote', town[4].name],
                    [clients[1], '/vote', town[4].name],
                    [clients[2], '/vote', town[4].name],
                    [clients[3], '/vote', town[4].name]
                ]);
            })
            .then(() => {
                const { town, mafia } = getPlayersByRoleAndAlignment();

                return performTimedCommands([
                    [mafia[0], '/act', `kill ${town[0].name}`],
                    [mafia[1], '/act', `kill ${town[1].name}`]
                ]);
            })
            .then(() => {
                const { town, mafia } = getPlayersByRoleAndAlignment();
                const sCalls = slackMock.slashCommands.calls;
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const factionChannels = gamestate.getState().factionChannels;

                wCalls.slice(-1)[0].should.eql(buildChatCall(factionChannels.get(constants.Alignment.Mafia),
                    `${mafia[1].name} will kill ${town[1].name}`));

            });
    }

    @test nightActionResolution() {
        return clients[0].doSlashCommand('/setup', 'bird')
            .then(() => {
                return Promise.all(clients.map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const { vanilla } = getPlayersByRoleAndAlignment();

                return performTimedCommands([
                    [clients[0], '/vote', vanilla[2].name],
                    [clients[1], '/vote', vanilla[2].name],
                    [clients[2], '/vote', vanilla[2].name],
                    [clients[3], '/vote', vanilla[2].name]
                ]);
            })
            .then(() => {
                const { town, mafia, cop, doctor, vanilla } = getPlayersByRoleAndAlignment();
                return performTimedCommands([
                    [mafia[0], '/act', `kill ${cop.name}`],
                    [doctor, '/act', `protect ${cop.name}`],
                    [cop, '/act', `investigate ${mafia[0].name}`]
                ]);
            })
            .then(() => {
                return Promise.delay(6000);
            })
            .then(() => {
                const sCalls = slackMock.slashCommands.calls;
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));

                const players = gamestate.getState().playerSlots;
                const { town, mafia, cop, doctor, vanilla } = getPlayersByRoleAndAlignment();

                players.get(cop.id).isAlive.should.be.false;
            });
    }

    @test townVictory() {
        return clients[0].doSlashCommand('/setup', 'simple')
            .then(() => {
                return Promise.all(clients.slice(0, 3).map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const { town, mafia } = getPlayersByRoleAndAlignment();

                return Promise.all([town, mafia, performTimedCommands([
                    [town[0], '/vote', mafia[0].name],
                    [town[1], '/vote', mafia[0].name]
                ])]);
            })
            .then(([town, mafia]) => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls;

                wCalls.slice(-1)[0].should.satisfy(msg => msg.params.text === [
                    `The game has ended. The Town, consisting of:`,
                    town[0].name,
                    town[1].name,
                    `has won!`
                ].join('\n') || msg.params.text === [
                    `The game has ended. The Town, consisting of:`,
                    town[1].name,
                    town[0].name,
                    `has won!`
                ].join('\n'));

                gamestate.getState().currentPhase.should.eql({ time: constants.TimeOfDay.WaitingForPlayers });
            });
    }

    @test mafiaVictory() {
        return clients[0].doSlashCommand('/setup', 'simple')
            .then(() => {
                return Promise.all(clients.slice(0, 3).map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const { town, mafia } = getPlayersByRoleAndAlignment();

                return Promise.all([town, mafia, performTimedCommands([
                    [town[0], '/vote', town[1].name],
                    [mafia[0], '/vote', town[1].name]
                ])]);
            })
            .then(([town, mafia]) => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls;

                wCalls.slice(-1)[0].should.eql(buildChatCall(`#${process.env.SLACK_GAME_CHANNEL}`, [
                    `The game has ended. The Mafia, consisting of:`,
                    mafia[0].name,
                    `has won!`
                ].join('\n')));

                gamestate.getState().currentPhase.should.eql({ time: constants.TimeOfDay.WaitingForPlayers });
            });
    }

    @test nighttimeMafiaVictory() {
        return clients[0].doSlashCommand('/setup', 'simple')
            .then(() => {
                return Promise.all(clients.slice(0, 3).map(client => client.doSlashCommand('/in')));
            })
            .then(() => {
                const { town, mafia } = getPlayersByRoleAndAlignment();

                return Promise.all([town, mafia, performTimedCommands([
                    [town[0], '/vote', 'no lynch'],
                    [mafia[0], '/vote', 'no lynch']
                ])]);
            })
            .then(([town, mafia]) => {
                return Promise.all([town, mafia, performTimedCommands([
                    [mafia[0], '/act', `kill ${town[1].name}`],
                ])]);
            })
            .then(([town, mafia]) => {
                return Promise.all([town, mafia, Promise.delay(6000)]);
            })
            .then(([town, mafia]) => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls;

                wCalls.slice(-1)[0].should.eql(buildChatCall(`#${process.env.SLACK_GAME_CHANNEL}`, [
                    `The game has ended. The Mafia, consisting of:`,
                    mafia[0].name,
                    `has won!`
                ].join('\n')));

                gamestate.getState().currentPhase.should.eql({ time: constants.TimeOfDay.WaitingForPlayers });
            });
    }
}