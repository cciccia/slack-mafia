import * as _ from "lodash";
import * as Promise from 'bluebird';

import { getEdn } from '../utils';
const edn = getEdn();

import { getSetup, getFirstSetup } from './setup';
import {
    TimeOfDay, AbilityType, ParityType, AlignmentAttributesMap, Alignment, AbilityActivationType,
    NOT_VOTING_NAME, NOT_VOTING_DISP, NO_LYNCH_NAME, NO_LYNCH_DISP
} from '../constants';
import { Action, abilityFactory, validate, actionResolver, actionDescriber } from './ability';
import { Slot } from './slot';

import {
    createPrivateChannel, getChannelNameFromId, getChannelIdFromName,
    getUserNameFromId, getUserIdFromName, postMessage, postPublicMessage,
    getUserIdToNameMap, getUserNameToIdMap
} from '../comm/restCommands';

const shortId = require('shortid');

export interface Phase {
    time: TimeOfDay;
    num?: number;
}

export interface Vote {
    voterId: string;
    voteeName?: string;
}

// game transcending state
let currentSetup;

// faction info
let factionChannels = new Map<Alignment, string>();

// global (semi) permanent state
let currentGameId: string;
let currentPhase: Phase;

// player info
let playerIds: Array<string> = [];
let playerSlots = new Map<string, Slot>();

// global temporary state
let currentActions: Action[] = [];
let currentVotes: Map<string, string[]>;

// night end handler;
let nightEndTimeout;

// slash command entry points
export function setSetup(tag: string): any {
    return Promise.try(() => {
        if (currentPhase && currentPhase.time === TimeOfDay.WaitingForPlayers) {
            const newSetup = getSetup(tag.toLowerCase());
            if (newSetup) {
                currentSetup = newSetup;
                return postPublicMessage(`Setup was changed to ${currentSetup[':name']} (${currentSetup[':slots'].length} players)`);
            } else {
                throw new Error(`${tag.toLowerCase()} is not a valid setup.`);
            }
        } else {
            throw new Error(`Cannot change setup at this time.`);
        }
    });
}

export function addPlayer(playerId: string) {
    return Promise.try(() => {
        if (currentPhase && currentPhase.time !== TimeOfDay.WaitingForPlayers) {
            throw new Error("Cannot join game in progress");
        }

        const idx = playerIds.indexOf(playerId);

        if (playerIds.length >= currentSetup[':slots'].length) {
            throw new Error("Game is full!");
        } else if (idx === -1) {
            playerIds.push(playerId);
            return getUserNameFromId(playerId)
                .then(name => postPublicMessage(`${name} has joined.`))
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
        if (currentPhase && currentPhase.time !== TimeOfDay.WaitingForPlayers) {
            throw new Error("Cannot leave game in progress");
        }
        const idx = playerIds.indexOf(playerId);
        if (idx !== -1) {
            playerIds.splice(idx, 1);
            return getUserNameFromId(playerId)
                .then(name => postPublicMessage(`${name} has left.`));
        } else {
            throw new Error("You are not currently signed up.");
        }
    });
}

export function requestVoteCount(playerId: string) {
    return Promise.resolve(requirePlaying(playerId))
        .then(() => {
            return doVoteCount();
        });
}

export function addOrReplaceAction(actorId: string, actionName: string, targetName: string) {
    return Promise.resolve(requirePlaying(actorId))
        .then(() => {
            return getUserNameToIdMap();
        })
        .then(namesToIds => {
            const targetId = namesToIds.get(targetName);

            const livingPlayers = getLivingPlayers();

            if (!targetId || !livingPlayers.find(livingPlayer => livingPlayer.playerId === targetId)) {
                throw new Error(`No player ${targetName} is currently playing and alive.`);
            }

            return addOrReplaceFormattedAction({
                actor: playerSlots.get(actorId),
                abilityType: actionResolver(actionName),
                target: targetId == null ? null : playerSlots.get(targetId)
            });
        });
}

export function setVote({ voterId, voteeName }: Vote) {
    return Promise.resolve(requirePlaying(voterId))
        .then(() => {
            if (currentPhase.time !== TimeOfDay.Day) {
                throw new Error("You cannot vote right now.");
            }

            return getUserIdFromName(voteeName);
        }).then(voteeId => {
            const livingPlayers = getLivingPlayers();
            if (!voteeId ||
                (!livingPlayers.find(livingPlayer => livingPlayer.playerId === voteeId) &&
                    voteeId !== NOT_VOTING_NAME &&
                    voteeId !== NO_LYNCH_NAME)) {
                throw new Error(`No player ${voteeName} is currently playing and alive.`);
            }

            for (const [votee, votes] of currentVotes.entries()) {
                const idx = votes.indexOf(voterId);
                if (idx > -1) {
                    votes.splice(idx, 1);
                }
            }

            currentVotes.get(voteeId).push(voterId);
            return Promise.all([voteeId, getUserNameFromId(voterId)]);
        })
        .then(([voteeId, voterName]) => {
            if (voteeId === NOT_VOTING_NAME) {
                return postPublicMessage(`${voterName} is no longer voting.`);
            } else if (voteeId === NO_LYNCH_NAME) {
                return postPublicMessage(`${voterName} is now voting ${NO_LYNCH_DISP}.`);
            } else {
                return postPublicMessage(`${voterName} is now voting ${voteeName}.`);
            }
        })
        .then(() => {
            const vc = getVc();
            const halfPlus1 = Math.floor(getLivingPlayerCount() / 2) + 1;

            const lynch = vc.find(([voteeId, votes]) => votes.length >= halfPlus1);

            if (lynch) {
                const [lyncheeId, votesToLynch] = lynch;
                return Promise.all([lyncheeId, getUserNameFromId(lyncheeId)]);
            } else {
                return Promise.resolve([null, null]);
            }
        })
        .then(([lyncheeId, lyncheeName]) => {
            if (lyncheeId && (lyncheeId !== NOT_VOTING_NAME)) {
                const message: string[] = [];

                if (lyncheeId !== NO_LYNCH_NAME) {
                    const slot = playerSlots.get(lyncheeId);
                    slot.die();

                    const victor = isGameOver();
                    if (victor != null) {
                        return endGame(victor);
                    }
                    message.push(`${lyncheeName} was lynched. They were a ${slot.name}.`);
                    message.push(`It is now Night ${currentPhase.num}. Night will last ${process.env.NIGHT_LENGTH} seconds.`);
                } else {
                    message.push(`No one was lynched.`);
                    message.push(`It is now Night ${currentPhase.num}. Night will last ${process.env.NIGHT_LENGTH} seconds.`);
                }
                changePhase({ time: TimeOfDay.Night, num: currentPhase.num });
                nightEndTimeout = setTimeout(endNight, parseInt(process.env.NIGHT_LENGTH, 10) * 1000);

                return postPublicMessage(message.join('\n'));
            }
        });
}


// other public getter/setters
export function reset(): void {
    changePhase({ time: TimeOfDay.WaitingForPlayers });
    if (nightEndTimeout) {
        clearTimeout(nightEndTimeout);
    }

    if (!currentSetup) {
        setSetup(getFirstSetup()[':tag']);
    }
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

export function getPhase(): Phase {
    return currentPhase;
}



// private module methods
function requirePlaying(playerId: string): Promise<any> {
    return Promise.try(() => {
        if (!playerSlots.has(playerId)) {
            throw new Error('You are not currently playing!');
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
            changePhase({ time: TimeOfDay.Day, num: 1 });
            return postPublicMessage(`It is now Day 1.`)
                .then(() => {
                    initVotes();
                    doVoteCount();
                });
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
            return createPrivateChannel(`${AlignmentAttributesMap.get(alignment).name}-${getGameId()}`, members, alignment)
                .then(channelId => {
                    factionChannels.set(alignment, channelId);
                    return postMessage(channelId, `Hello.  You are the ${AlignmentAttributesMap.get(alignment).name}`);
                });
        }));
}

function sendRoles() {
    return Promise.all(Array.from(playerSlots.entries())
        .map(([playerId, slot]) => {
            return Promise.all([slot, getUserNameFromId(playerId)])
                .then(([slot, playerName]) => {
                    return postMessage(`@${playerName}`, `Your role is: ${slot.name}.`);
                });
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

function addOrReplaceFormattedAction(action: Action) {
    return Promise.try(() => {
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
            return Promise.all([
                action,
                getUserNameFromId(action.actor.playerId),
                action.target ? getUserNameFromId(action.target.playerId) : null
            ])
                .then(([action, playerName, targetName]) => {
                    return postMessage(
                        factionChannels.get(action.actor.alignment),
                        getActionsForFaction(action.actor.alignment).map(action => {
                            let a = `${playerName} will ${actionDescriber(action.abilityType)}`;

                            if (action.target) {
                                a += ` ${targetName}`;
                            }
                            return a;
                        }).join('\n'));
                });
        }
    });
}

function getVc(): any[] {
    return Array.from(currentVotes.entries()).reduce((acc, [voteeId, votes]) => {
        acc.push([voteeId, votes]);
        return acc;
    }, [])
        .filter(([voteeId, votes]) => votes.length > 0)
        .sort((a, b) => {
            if (a[0] === NOT_VOTING_NAME) {
                return 1;
            } else if (b[0] === NOT_VOTING_NAME) {
                return -1;
            } else {
                return b[1].length - a[1].length;
            }
        });
}

function getLivingPlayers(): Slot[] {
    return Array.from(playerSlots.values()).filter(slot => slot.isAlive);
}

function getLivingPlayerCount(): number {
    return getLivingPlayers().length;
}

function initVotes(): void {
    const livingPlayerIdsUnordered = getLivingPlayers().map(player => player.playerId);
    const livingPlayerIds = playerIds.filter(playerId => livingPlayerIdsUnordered.includes(playerId));

    currentVotes = livingPlayerIds
        .reduce((acc, playerId) => {
            acc.set(playerId, []);
            return acc;
        }, new Map<string, string[]>());

    currentVotes.set(NOT_VOTING_NAME, []);
    currentVotes.set(NO_LYNCH_NAME, []);

    livingPlayerIds.forEach(playerId => {
        currentVotes.get(NOT_VOTING_NAME).push(playerId);
    });
}

function getActionsForFaction(faction: Alignment): Action[] {
    return currentActions.filter(action => {
        return action.actor.alignment === faction;
    });
}

function endNight() {
    const passivesToApply = [];
    Array.from(playerSlots.values()).forEach(slot => {
        slot.abilities.forEach(ability => {
            const abilityDef = abilityFactory(ability.abilityType);
            if (abilityDef.activationType === AbilityActivationType.Passive) {
                passivesToApply.push(addOrReplaceFormattedAction({
                    actor: slot,
                    abilityType: ability.abilityType
                })
                    .catch(e => { }));
            }
        });
    });

    return Promise.all(passivesToApply)
        .then(() => {
            return Promise.each(currentActions, action => {
                const ability = abilityFactory(action.abilityType);
                action.actor.consumeAbility(action.abilityType);
                return Promise.resolve(ability.resolve(action.actor, action.target));
            });
        })
        .then(() => {
            const victor = isGameOver();
            if (victor != null) {
                return endGame(victor);
            }

            changePhase({ time: TimeOfDay.Day, num: currentPhase.num + 1 });
            return postPublicMessage(`It is now Day ${currentPhase.num}`)
                .then(() => {
                    initVotes();
                    doVoteCount();
                });
        });
}

function doVoteCount() {
    const vc = getVc();
    const message: string[] = ['Votecount:'];

    const livingPlayers = getLivingPlayerCount();
    const halfPlusOne = Math.floor(livingPlayers / 2) + 1;

    return getUserIdToNameMap()
        .then(idToNameMap => {
            vc.forEach(([voteeId, votes]) => {
                if (voteeId === NOT_VOTING_NAME) {
                    message.push([
                        `[${votes.length}] ${NOT_VOTING_DISP}: `,
                        `(${votes.map(vote => idToNameMap.get(vote)).join(', ')})`
                    ].join(''));
                } else if (voteeId === NO_LYNCH_NAME) {
                    message.push([
                        `[${votes.length}] ${NO_LYNCH_DISP}: `,
                        `(${votes.map(vote => idToNameMap.get(vote)).join(', ')})`
                    ].join(''));
                } else {
                    message.push([
                        `[${votes.length}] ${idToNameMap.get(voteeId)}: `,
                        `(${votes.map(vote => idToNameMap.get(vote)).join(', ')})`
                    ].join(''));
                }
            });

            message.push('');
            message.push(`With ${getLivingPlayerCount()} alive, it is ${halfPlusOne} to lynch.`);

            return postPublicMessage(message.join('\n'));
        });
}

function isGameOver(): Alignment {
    const livingPlayers = getLivingPlayers();

    // town
    if (livingPlayers.every(player => player.alignment === Alignment.Town)) {
        return Alignment.Town;
    }

    const livingMafia = livingPlayers.filter(player => player.alignment === Alignment.Mafia);
    if (livingMafia.length >= livingPlayers.length / 2) {
        return Alignment.Mafia;
    }

    return null;
}

function endGame(victor: Alignment) {
    const winners = Array.from(playerSlots.values()).filter(slot => slot.alignment === victor);

    return getUserIdToNameMap()
        .then(idToNameMap => {
            let message = [`The game has ended. The ${AlignmentAttributesMap.get(victor).name}, consisting of:`];
            message = message.concat(winners.map(winner => idToNameMap.get(winner.playerId)));
            message.push(`has won!`);
            reset();
            return postPublicMessage(message.join('\n'));
        });
}