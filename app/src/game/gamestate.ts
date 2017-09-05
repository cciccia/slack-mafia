import * as _ from "lodash";
import * as Promise from 'bluebird';

import { getEdn } from '../utils';
const edn = getEdn();

import { getSetup, getFirstSetup } from './setup';
import { TimeOfDay, AbilityType, ParityType, AlignmentAttributesMap, Alignment, AbilityActivationType } from '../constants';
import { Action, abilityFactory, validate, actionResolver, actionDescriber } from './ability';
import { Slot } from './slot';

import bot from '../comm/bot';
import { createPrivateChannel } from '../comm/restCommands';

const shortId = require('shortid');

export interface Phase {
    time: TimeOfDay;
    num?: number;
}

export interface Vote {
    voterId: string;
    voteeId?: string;
}

const NOT_VOTING: string = 'Not Voting';

// game transcending state
let currentSetup;

// faction info
let factionChannels = new Map<Alignment, string>();

// global (semi) permanent state
let currentGameId: string;
let currentPhase: Phase;

// player info
let playerIds: Array<string> = [];
let playerUserData: Array<any>;
let playerSlots = new Map<string, Slot>();

// global temporary state
let currentActions: Action[] = [];
let currentVotes: Map<string, string[]>;

function requirePlaying(playerId: string): void {
    if (!playerSlots.has(playerId)) {
        throw new Error('You are not currently playing!');
    }
}

function getPlayerUserMap() {
    return Promise.all(playerIds.map(playerId => bot.getUserById(playerId)))
        .then(users => users.reduce((acc, user) => {
            acc.set(user.id, user);
            return acc;
        }, new Map<string, any>()));
}

export function reset(): void {
    changePhase({ time: TimeOfDay.WaitingForPlayers });
    currentGameId = undefined;

    playerIds.length = 0;
    playerSlots.clear();

    currentActions.length = 0;
    initVotes();

}

export function getPlayers(): Map<string, Slot> {
    return playerSlots;
}

export function getGameId(): string {
    return currentGameId;
}

export function setDefaultSetup(): void {
    currentSetup = getFirstSetup();
}

export function getCurrentSetup(): any {
    return currentSetup;
}

export function getFactionChannels(): Map<Alignment, string> {
    return factionChannels;
}

export function setSetup(tag: string): any {
    return Promise.try(() => {
        if (currentPhase && currentPhase.time === TimeOfDay.WaitingForPlayers) {
            const newSetup = getSetup(tag);
            if (newSetup) {
                currentSetup = newSetup;
                return bot.postPublicMessage(`Setup was changed to ${currentSetup[':name']} (${currentSetup[':slots'].length} players)`);
            } else {
                throw new Error(`${tag} is not a valid setup.`);
            }
        } else {
            throw new Error(`Cannot change setup at this time.`);
        }
    });
}

function startGame() {
    changePhase({ time: TimeOfDay.Pregame });
    currentGameId = shortId.generate();
    playerSlots.clear();

    const shuffledPlayers = _.shuffle(playerIds);

    shuffledPlayers.forEach((playerId, i) => {
        const rawSlot = currentSetup[':slots'][i];

        const name = rawSlot[':name'];
        const alignment = rawSlot[':alignment'];

        const abilities = rawSlot[':abilities'].map(ability => {
            return {
                abilityType: ability[':ability-type'],
                usage: {
                    charges: (ability[':usage'] && ability[':usage'][':charges']) || -1,
                    parity: (ability[':usage'] && ability[':usage'][':parity']) || ParityType.Any,
                    time: (ability[':usage'] && ability[':usage'][':time']) || TimeOfDay.Night
                }
            };
        });

        const slot = new Slot(playerId, name, alignment, abilities);
        playerSlots.set(playerId, slot);
    });

    return Promise.all([createPrivateChannels(), sendRoles()])
        .then(() => {
            initVotes();
            changePhase({ time: TimeOfDay.Day, num: 1 });
            return bot.postPublicMessage(`It is now Day 1.`);
        });
}

function createPrivateChannels() {
    const alignmentMap = Array.from(playerSlots.values())
        .reduce((p, c) => {
            if (!p.has(c.alignment)) {
                return p.set(c.alignment, [c.playerId]);
            } else {
                p.get(c.alignment).push(c.playerId);
                return p;
            }
        }, new Map<Alignment, [string]>());

    return Promise.all(Array.from(alignmentMap.entries())
        .filter(([alignment, _]) => alignment !== Alignment.Town)
        .map(([alignment, members]) => {
            return createPrivateChannel(`${AlignmentAttributesMap.get(alignment).name}-${getGameId()}`, members)
                .then(channelId => {
                    return factionChannels.set(alignment, channelId);
                });
        }));
}

function sendRoles() {
    return Promise.all(Array.from(playerSlots.entries())
        .map(([playerId, slot]) => {
            return bot.postMessageToUserById(playerId, `Your role is: ${slot.name}.`);
        }));
}

function changePhase(phase: Phase): void {
    currentPhase = phase;
    initVotes();

    for (const playerId of playerIds) {
        if (playerSlots.has(playerId)) {
            playerSlots.get(playerId).resetMutableState();
        }
    }
}

export function addPlayer(playerId: string) {
    return Promise.try(() => {
        const idx = playerIds.indexOf(playerId);

        if (playerIds.length >= currentSetup[':slots'].length) {
            throw new Error("Game is full!");
        } else if (idx === -1) {
            playerIds.push(playerId);
            return bot.getUserById(playerId)
                .then(player => bot.postPublicMessage(`${player.name} has joined.`))
                .then(() => {
                    if (currentSetup && (currentSetup[':slots'].length === playerIds.length)) {
                        return startGame();
                    }
                });
        } else {
            throw new Error("You are already signed up!");
        }
    });
}

export function removePlayer(playerId: string) {
    return Promise.try(() => {
        const idx = playerIds.indexOf(playerId);
        if (idx !== -1) {
            playerIds.splice(idx, 1);
            return bot.getUserById(playerId)
                .then(player => bot.postPublicMessage(`${player.name} has left.`));
        } else {
            throw new Error("You are not currently signed up.");
        }
    });
}

export function addOrReplaceAction(actorId: string, actionName: string, targetId: string, targetName: string) {
    requirePlaying(actorId);

    if (!playerSlots.has(targetId)) {
        throw new Error(`${targetName} is not currently playing!`);
    }

    return addOrReplaceFormattedAction({
        actor: playerSlots.get(actorId),
        abilityType: actionResolver(actionName),
        target: targetId == null ? null : playerSlots.get(targetId)
    });
}

function addOrReplaceFormattedAction(action: Action) {
    const abilityDef = abilityFactory(action.abilityType);

    if (!validate(action, currentPhase)) {
        throw new Error('You are unable to perform this action.');
    }

    //remove any previous actions by that player of that type
    let dedupers = [action.actor.playerId];

    //factional actions may only be performed by one faction member per night
    if (abilityDef.activationType === AbilityActivationType.Factional) {
        dedupers = _.filter(Array.from(playerSlots), ([player, slot]) => slot.alignment === action.actor.alignment)
            .map(([player, slot]) => player);
    }

    // remove action overwritten by the new one received if any
    _(currentActions)
        .remove(currentAction => action.abilityType === currentAction.abilityType && _(dedupers).includes(currentAction.actor.playerId))
        .value();

    // add new action
    currentActions.push(action);
    currentActions.sort((a, b) => {
        return a.abilityType - b.abilityType;
    });

    if (factionChannels.has(action.actor.alignment)) {
        return getPlayerUserMap()
            .then(userMap => {
                return bot.postMessage(
                    factionChannels.get(action.actor.alignment),
                    getActionsForFaction(action.actor.alignment).map(action => {
                        let a = `${userMap.get(action.actor.playerId).name} will ${actionDescriber(action.abilityType)}`;

                        if (action.target) {
                            a += ` ${userMap.get(action.target.playerId).name}`;
                        }
                        return a;
                    }).join('\n'));
            });
    }
}

export function getActionsForFaction(faction: Alignment): Action[] {
    return currentActions.filter(action => {
        return action.actor.alignment === faction;
    });
}

export function getPhase(): Phase {
    return currentPhase;
}

function getVc(): any[] {
    return Array.from(currentVotes.entries()).reduce((acc, [voteeId, votes]) => {
        acc.push([voteeId, votes]);
        return acc;
    }, [])
        .filter(([voteeId, votes]) => votes.length > 0)
        .sort((a, b) => {
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

function initVotes(): void {
    currentVotes = playerIds.reduce((acc, playerId) => {
        acc.set(playerId, []);
        return acc;
    }, new Map<string, string[]>());

    currentVotes.set(NOT_VOTING, []);

    playerIds.forEach(playerId => {
        currentVotes.get(NOT_VOTING).push(playerId);
    });
}

export function setVote({ voterId, voteeId }: Vote) {
    if (currentPhase.time !== TimeOfDay.Day) {
        throw new Error("You cannot vote right now.");
    }

    if (!voteeId) {
        voteeId = NOT_VOTING;
    }

    for (const [votee, votes] of currentVotes) {
        const idx = votes.indexOf(voterId);
        if (idx > -1) {
            votes.splice(idx, 1);
        }
    }

    currentVotes.get(voteeId).push(voterId);

    return getPlayerUserMap()
        .then(userMap => {
            if (voteeId !== NOT_VOTING) {
                return Promise.all([
                    userMap,
                    bot.postPublicMessage(`${userMap.get(voterId).name} is now voting ${userMap.get(voteeId).name}.`)
                ]);
            } else {
                return Promise.all([
                    userMap, bot.postPublicMessage(`${userMap.get(voterId).name} is no longer voting.`)
                ]);
            }
        })
        .then(([userMap, _]) => {
            const vc = getVc();
            const halfPlus1 = Math.floor(getLivingPlayers() / 2) + 1;

            const [lyncheeId, votesToLynch] = vc.find(([voteeId, votes]) => votes.length >= halfPlus1);

            //a lynch has been reached.
            if (lyncheeId && (lyncheeId !== NOT_VOTING)) {
                const slot = playerSlots.get(lyncheeId);
                slot.die();
                changePhase({ time: TimeOfDay.Night, num: currentPhase.num });
                setTimeout(endNight, 300000);  //TODO parametrize?

                const message: string[] = [];
                message.push(`${userMap.get(lyncheeId).name} was lynched. They were a ${slot.name}.`);
                message.push(`It is now Night ${currentPhase.num}. Night will last 5 minutes.`);

                return bot.postPublicMessage(message.join('\n'));
            }
        });
}

export function doVoteCount() {
    const vc = getVc();
    const message: string[] = ['Votecount:'];

    const livingPlayers = getLivingPlayers();
    const halfPlusOne = Math.floor(livingPlayers / 2) + 1;

    return getPlayerUserMap()
        .then(userMap => {
            vc.forEach(([voteeId, votes]) => {
                if (voteeId !== NOT_VOTING) {
                    message.push([
                        `[${votes.length}] ${userMap.get(voteeId).name}: `,
                        `(${votes.map(vote => userMap.get(vote).name).join(', ')})`
                    ].join(''));
                } else {
                    message.push([
                        `[${votes.length}] ${NOT_VOTING}: `,
                        `(${votes.map(vote => userMap.get(vote).name).join(', ')})`
                    ].join(''));
                }
            });

            message.push('');
            message.push(`With ${getLivingPlayers()} alive, it is ${halfPlusOne} to lynch.`);

            return bot.postPublicMessage(message.join('\n'));
        });
}

function endNight() {
    // apply all passives
    playerSlots.forEach(slot => {
        slot.abilities.forEach(ability => {
            const abilityDef = abilityFactory(ability.abilityType);
            if (abilityDef.activationType === AbilityActivationType.Passive) {
                try {
                    addOrReplaceFormattedAction({
                        actor: slot,
                        abilityType: ability.abilityType
                    });
                } finally { }
            }
        });
    });

    currentActions.forEach(action => {
        const ability = abilityFactory(action.abilityType);
        action.actor.consumeAbility(action.abilityType);
        ability.resolve(action.actor, action.target);
    });

    changePhase({ time: TimeOfDay.Day, num: currentPhase.num + 1 });
    bot.postPublicMessage(`It is now Day ${currentPhase.num}`)
        .then(() => {
            initVotes();
            doVoteCount();
        });
}