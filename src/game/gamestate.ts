import * as _ from "lodash";

import { TimeOfDay, AbilityType } from '../constants';
import { Action, abilityFactory } from './ability';
import { Slot } from './slot';

export interface Phase {
    time: TimeOfDay;
    num?: number;
}

export interface Vote {
    voter: string;
    votee?: string;
}

export interface Message {
    recipient: string;
    message: string;
}

const NOT_VOTING: string = 'Not Voting';

// player info
let players: Array<string> = [];
let playerSlots = new Map<string, Slot>();

// global (semi) permanent state
let currentPhase: Phase;
let daytalkEnabled: boolean = false;

// global temporary state
let currentActions: Action[] = [];
let currentNightMessages: Message[] = [];
let currentVotes = new Map<string, string>();

export function changePhase(phase: Phase): void {
    currentPhase = phase;

    for (const player of players) {
        playerSlots[player].resetMutableState();
        currentVotes[player] = NOT_VOTING;
    }
}

export function init(): void {
    changePhase({ time: TimeOfDay.WaitingForPlayers });
}

export function addPlayer(player: string): void {
    const idx = players.indexOf(player);
    if (idx === -1) {
        players.push(player);
    } else {
        //TODO reject
    }
}

export function removePlayer(player: string): void {
    const idx = players.indexOf(player);
    if (idx !== -1) {
        players.splice(idx, 1);
    } else {
        //TODO reject
    }
}

export function addOrReplaceAction(action: Action): void {
    //remove any previous actions by that player of that type
    let dedupers = [action.actor.player];

    //factional kill has a special case that only one member of a faction can do it in a night
    if (action.abilityType === AbilityType.FactionalKill) {
        dedupers = _.filter(Array.from(playerSlots), ([player, slot]) => slot.alignment === action.actor.alignment)
            .map(([player, slot]) => player);
    }

    // remove action overwritten by the new one received if any
    _(currentActions)
        .remove(currentAction => action.abilityType === currentAction.abilityType && _(dedupers).includes(currentAction.actor.player));

    // add new action
    currentActions.push(action);
}

export function addMessage(message: Message): void {
    currentNightMessages.push(message);
}

export function getPhase(): Phase {
    return currentPhase;
}

function getVc() {
    let vc: [string, string[]][];

    for (let [voter, votee] of currentVotes.entries()) {
        const entry = vc.find(([vcVotee, vcVotes]) => votee === vcVotee);
        if (!entry) {
            vc.push([votee, []]);
        }
        entry[1].push(voter);
    }

    // Not Voting should always be listed last.
    return vc.sort((a, b) => {
        if (a[0] === NOT_VOTING) {
            return 1;
        } else if (b[0] === NOT_VOTING) {
            return -1;
        } else {
            return b[1].length - a[1].length;
        }
    });
}

function getLivingPlayers(): number {
    return players.filter(player => playerSlots[player].isAlive).length;
}

export function setVote({ voter, votee }: Vote) {
    if (!votee) {
        votee = NOT_VOTING;
    }
    currentVotes[voter] = votee;
    const vc = getVc();
    const halfPlus1 = Math.floor(getLivingPlayers() / 2) + 1;

    const [lynchee, votesToLynch] = vc.find(([votee, votes]) => votes.length >= halfPlus1);

    //a lynch has been reached.
    if (lynchee) {
        playerSlots[lynchee].die();

        // message about lynch, flip, night goes here

        // flip to night
        changePhase({ time: TimeOfDay.Night, num: currentPhase.num });
    }
}

export function buildVoteCountMessage() {
    const vc = getVc();
    const message: string[] = ['Votecount:'];

    const livingPlayers = getLivingPlayers();
    const halfPlusOne = Math.floor(livingPlayers / 2) + 1;

    vc.forEach(([votee, votes]) => {
        message.push(`[${votes.length}] ${votee}: (${votes.join(', ')})`);
    });

    message.push('');
    message.push(`With ${getLivingPlayers()} alive, it is ${halfPlusOne} to lynch.`);

    return message.join('\n');
}

export function endNight() {
    const sortedActions = currentActions.sort((a, b) => {
        return a.abilityType - b.abilityType;
    });

    sortedActions.forEach(action => {
        const ability = abilityFactory(action.abilityType);
        action.actor.consumeAbility(action.abilityType);
        ability.resolve(action.actor, action.target);
    });

    //process all messages here
    changePhase({ time: TimeOfDay.Day, num: currentPhase.num + 1 });

}