import * as _ from "lodash";

import { getEdn } from '../utils';
const edn = getEdn();

import { getSetup, getFirstSetup } from './setup';
import { TimeOfDay, AbilityType, ParityType } from '../constants';
import { Action, abilityFactory } from './ability';
import { Slot } from './slot';

import bot from '../comm/bot';

export interface Phase {
    time: TimeOfDay;
    num?: number;
}

export interface Vote {
    voterId: string;
    voteeId?: string;
}

const NOT_VOTING: string = 'Not Voting';

// player info
let playerIds: Array<string> = [];
let playerSlots = new Map<string, Slot>();

// global (semi) permanent state
let currentSetup;
let currentPhase: Phase;
let daytalkEnabled: boolean = false;

// global temporary state
let currentActions: Action[] = [];
let currentVotes = new Map<string, string>();

export function setDefaultSetup(): void {
    currentSetup = getFirstSetup();
    bot.postPublicMessage(`Setup was changed to "${currentSetup.at(edn.kw(':name'))}".`);
}

export function setSetup(tag: string): void {
    if (currentPhase.time !== TimeOfDay.WaitingForPlayers) {
        try {
            currentSetup = getSetup(tag);
            bot.postPublicMessage(`Setup was changed to "${currentSetup.at(edn.kw(':name'))}".`);
        } catch (e) {
            bot.postPublicMessage(`${tag} is not a valid setup.`);
        }
    }
}

export function startGame(): void {
    playerSlots.clear();

    const shuffledPlayers = _.shuffle(playerIds);
    shuffledPlayers.forEach((playerId, i) => {
        const rawSlot = currentSetup.at(edn.kw(':slots')).at(i);

        const name = rawSlot.at(edn.kw(':name'));
        const alignment = rawSlot.at(edn.kw(':alignment'));

        const abilities = rawSlot.at(edn.kw(':abilities')).map(ability => {
            return {
                abilityType: ability.at(edn.kw(':ability-type')),
                usage: {
                    charges: ability.atPath(':usage :charges') || -1,
                    parity: ability.atPath(':usage :parity') || ParityType.Any,
                    time: ability.atPath(':usage :time') || TimeOfDay.Night
                }
            };
        });

        const slot = new Slot(playerId, name, alignment, abilities);
        playerSlots.set(playerId, slot);
    });
}

export function changePhase(phase: Phase): void {
    currentPhase = phase;

    for (const playerId of playerIds) {
        playerSlots.get(playerId).resetMutableState();
        currentVotes.set(playerId, NOT_VOTING);
    }
}

export function init(): void {
    changePhase({ time: TimeOfDay.WaitingForPlayers });
}

export function addPlayer(playerId: string): void {
    const idx = playerIds.indexOf(playerId);
    if (idx === -1) {
        playerIds.push(playerId);
    } else {
        bot.postPublicMessage(`Player ${bot.getUserById(playerId).name} is already signed up.`);
    }
}

export function removePlayer(playerId: string): void {
    const idx = playerIds.indexOf(playerId);
    if (idx !== -1) {
        playerIds.splice(idx, 1);
    } else {
        // probably ignore?
    }
}

export function addOrReplaceAction(action: Action): void {
    //remove any previous actions by that player of that type
    let dedupers = [action.actor.playerId];

    //factional kill has a special case that only one member of a faction can do it in a night
    if (action.abilityType === AbilityType.FactionalKill) {
        dedupers = _.filter(Array.from(playerSlots), ([player, slot]) => slot.alignment === action.actor.alignment)
            .map(([player, slot]) => player);
    }

    // remove action overwritten by the new one received if any
    _(currentActions)
        .remove(currentAction => action.abilityType === currentAction.abilityType && _(dedupers).includes(currentAction.actor.playerId));

    // add new action
    currentActions.push(action);
}

export function getPhase(): Phase {
    return currentPhase;
}

function getVc() {
    let vc: [string, string[]][];

    for (let [voterId, voteeId] of currentVotes.entries()) {
        const entry = vc.find(([vcVoteeId, vcVotesId]) => voteeId === vcVoteeId);
        if (!entry) {
            vc.push([voteeId, []]);
        }
        entry[1].push(voterId);
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
    return playerIds.filter(playerId => playerSlots.get(playerId).isAlive).length;
}

function clearVotes(): void {
    for (const voterId of playerIds) {
        setVote({ voterId });
    }
}

export function setVote({ voterId, voteeId }: Vote) {
    if (currentPhase.time !== TimeOfDay.Day) {
        return;
    }

    if (!voteeId) {
        voteeId = NOT_VOTING;
    }
    currentVotes.set(voterId, voteeId);
    const vc = getVc();
    const halfPlus1 = Math.floor(getLivingPlayers() / 2) + 1;

    const [lyncheeId, votesToLynch] = vc.find(([voteeId, votes]) => votes.length >= halfPlus1);

    //a lynch has been reached.
    if (lyncheeId) {
        const slot = playerSlots.get(lyncheeId);
        slot.die();
        bot.postPublicMessage(`${bot.getUserById(lyncheeId).name} was lynched. They were a ${slot.name}.`);

        changePhase({ time: TimeOfDay.Night, num: currentPhase.num });

        bot.postPublicMessage(`It is now ${currentPhase.time} ${currentPhase.num}. Night will last 5 minutes.`);

        setTimeout(endNight, 300000);  //TODO parametrize?
    }
}

export function doVoteCount() {
    const vc = getVc();
    const message: string[] = ['Votecount:'];

    const livingPlayers = getLivingPlayers();
    const halfPlusOne = Math.floor(livingPlayers / 2) + 1;

    vc.forEach(([voteeId, votes]) => {
        bot.postPublicMessage(`[${votes.length}] ${voteeId}: (${votes.join(', ')}) `);
    });

    bot.postPublicMessage('');
    bot.postPublicMessage(`With ${getLivingPlayers()} alive, it is ${halfPlusOne} to lynch.`);
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

    changePhase({ time: TimeOfDay.Day, num: currentPhase.num + 1 });
    clearVotes();
    doVoteCount();
}