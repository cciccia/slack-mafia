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

let players: Array<string> = [];
let playerSlots = new Map<string, Slot>();

let currentPhase: Phase;
let currentActions: Action[] = [];
let currentMessages: Message[] = [];
let currentVotes = new Map<string, string>();

export function init() {
    currentPhase = { time: TimeOfDay.WaitingForPlayers };
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
    currentMessages.push(message);
}

export function getPhase(): Phase {
    return currentPhase;
}

export function setVote({ voter, votee }: Vote) {
    currentVotes[voter] = votee;
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
}