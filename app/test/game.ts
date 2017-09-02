import { slackMockForUsers } from './shared/slackMock';

const { slackMock, clients } = slackMockForUsers(7);

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

function buildGroupInviteCall(id) {
    return {
        url: `${process.env.SLACK_API_URL}/groups.invite`,
        params: {
            user: id,
            token: process.env.SLACK_API_TOKEN,
        }
    };
}

@suite class Game {
    static before() {
        return require('./shared/server');
    }

    before() {
        gamestate.reset();
        slackMock.reset();
    }

    @test setSetup() {
        return clients[0].doSlashCommand('/setup', 'boring')
            .then(() => {
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
            .then(() => Promise.delay(150))
            .then(() => {
                const wCalls = slackMock.web.calls.map(({ url, params }) => ({ url, params }));
                const sCalls = slackMock.slashCommands.calls.map(call => call.params);

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

                mafia.forEach(mafioso => {
                    wCalls.should.deep.contain(buildGroupInviteCall(mafioso[0]));
                });
            });
    }
}