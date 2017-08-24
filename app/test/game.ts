
import { suite, test, slow, timeout } from "mocha-typescript";
import * as chai from 'chai';
const should = chai.should();

import * as gamestate from '../src/game/gamestate';
import * as constants from '../src/constants';
import * as utils from '../src/utils';

import * as mockClient from './shared/mockClient';
import { slackMock } from './shared/slackMock';

const edn = utils.getEdn();

@suite class Game {
    static before() {
        return require('./shared/server');
    }

    before() {
        gamestate.reset();
    }

    @test setSetup() {
        const client = mockClient.clientFactory('admin');
        return client.doSlashCommand('/setup', 'boring')
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
        // gamestate.setSetup('boring');

    }
}