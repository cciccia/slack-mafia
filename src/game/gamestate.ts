import { TimeOfDay } from '../constants';
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

let players: string[] = [];
let playerSlots = new Map<string, Slot>();

let currentPhase: Phase;
let currentActions: Action[] = [];
let currentMessages: string[] = [];
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

export function addAction(action: Action): void {
    currentActions.push(action);
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