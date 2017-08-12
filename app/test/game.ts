const SlackMock = require('slack-mock')({ rtmPort: 9001, logLevel: 'info' });

import { suite, test, slow, timeout } from "mocha-typescript";
import { should } from 'chai';
should();

import * as gamestate from '../src/game/gamestate';
import * as constants from '../src/constants';

let slackMock;

@suite class Game {
    static before() {
        slackMock = SlackMock.instance;
    }

    @test init() {
        gamestate.init();

        gamestate.getPhase().should.eql({ time: constants.TimeOfDay.WaitingForPlayers });
    }
}