import * as _ from "lodash";
import * as Promise from 'bluebird';

import { getEdn } from '../utils';
const edn = getEdn();

import { Setup, getSetup, getFirstSetup } from './setup';
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

interface GameState {
    // game transcending
    currentSetup?: Setup;

    //factional
    factionChannels?: Map<Alignment, string>;

    //per-game-permanent
    currentGameId?: string;
    currentPhase?: Phase;

    //per-game-temporary
    currentActions?: Action[];
    currentVotes?: Map<string, string[]>;

    playerIds?: Array<string>;
    playerSlots?: Map<string, Slot>;
}

const state: GameState = {
    factionChannels: new Map(),
    playerIds: [],
    playerSlots: new Map(),
    currentActions: [],
    currentVotes: new Map()
};

export function getState(): GameState {
    return state;
}

export function updateState(newState: GameState): void {
    Object.assign(state, newState);
}

// night end handler;
let nightEndTimeout;

// slash command entry points
export function setSetup(tag: string): any {
    return Promise.try(() => {
        if (state.currentPhase && state.currentPhase.time === TimeOfDay.WaitingForPlayers) {
            const newSetup = getSetup(tag.toLowerCase());
            if (newSetup) {
                updateState({ currentSetup: newSetup });
                return postPublicMessage(`Setup was changed to ${state.currentSetup.name} (${state.currentSetup.slots.length} players)`);
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
        if (state.currentPhase && state.currentPhase.time !== TimeOfDay.WaitingForPlayers) {
            throw new Error("Cannot join game in progress");
        }

        const idx = state.playerIds.indexOf(playerId);

        if (state.playerIds.length >= state.currentSetup.slots.length) {
            throw new Error("Game is full!");
        } else if (idx === -1) {
            updateState({ playerIds: state.playerIds.concat([playerId]) });
            return getUserNameFromId(playerId)
                .then(name => postPublicMessage(`${name} has joined.`))
                .then(() => {
                    if (state.currentSetup && (state.currentSetup.slots.length === state.playerIds.length)) {
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
        if (state.currentPhase && state.currentPhase.time !== TimeOfDay.WaitingForPlayers) {
            throw new Error("Cannot leave game in progress");
        }
        const idx = state.playerIds.indexOf(playerId);
        if (idx !== -1) {
            updateState({ playerIds: state.playerIds.filter((playerId, i) => idx !== i) });
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
                actor: state.playerSlots.get(actorId),
                abilityType: actionResolver(actionName),
                target: targetId == null ? null : state.playerSlots.get(targetId)
            });
        });
}

export function setVote({ voterId, voteeName }: Vote) {
    return Promise.resolve(requirePlaying(voterId))
        .then(() => {
            if (state.currentPhase.time !== TimeOfDay.Day) {
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

            for (const [votee, votes] of state.currentVotes.entries()) {
                const idx = votes.indexOf(voterId);
                if (idx > -1) {
                    votes.splice(idx, 1);
                }
            }

            state.currentVotes.get(voteeId).push(voterId);
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
                    const slot = state.playerSlots.get(lyncheeId);
                    slot.die();

                    const victor = isGameOver();
                    if (victor != null) {
                        return endGame(victor);
                    }
                    message.push(`${lyncheeName} was lynched. They were a ${slot.name}.`);
                    message.push(`It is now Night ${state.currentPhase.num}. Night will last ${process.env.NIGHT_LENGTH} seconds.`);
                } else {
                    message.push(`No one was lynched.`);
                    message.push(`It is now Night ${state.currentPhase.num}. Night will last ${process.env.NIGHT_LENGTH} seconds.`);
                }
                changePhase({ time: TimeOfDay.Night, num: state.currentPhase.num });
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

    if (!state.currentSetup) {
        setSetup(getFirstSetup()[':tag']);
    }

    updateState({
        currentGameId: undefined,
        playerIds: [],
        playerSlots: new Map(),
        currentActions: []
    });

    initVotes();

}

// private module methods
function requirePlaying(playerId: string): Promise<any> {
    return Promise.try(() => {
        if (!state.playerSlots.has(playerId)) {
            throw new Error('You are not currently playing!');
        }
    });
}

function startGame() {
    changePhase({ time: TimeOfDay.Pregame });

    updateState({
        currentGameId: shortId.generate(),
        playerSlots: new Map()
    });

    const shuffledPlayers = _.shuffle(state.playerIds);

    shuffledPlayers.forEach((playerId, i) => {
        const slotSpec = state.currentSetup.slots[i];

        const name = slotSpec.name;
        const alignment = slotSpec.alignment;

        const abilities = slotSpec.abilities.map(ability => {
            return {
                abilityType: ability.abilityType,
                usage: ability.usage
            };
        });

        const slot = new Slot(playerId, name, alignment, abilities);
        updateState({
            playerSlots: new Map([...state.playerSlots, ...new Map([[playerId, slot]])])
        });
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
    const alignmentMap = Array.from(state.playerSlots.values())
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
            return createPrivateChannel(`${AlignmentAttributesMap.get(alignment).name}-${state.currentGameId}`, members, alignment)
                .then(channelId => {
                    state.factionChannels.set(alignment, channelId);
                    return postMessage(channelId, `Hello.  You are the ${AlignmentAttributesMap.get(alignment).name}`);
                });
        }));
}

function sendRoles() {
    return Promise.all(Array.from(state.playerSlots.entries())
        .map(([playerId, slot]) => {
            return Promise.all([slot, getUserNameFromId(playerId)])
                .then(([slot, playerName]) => {
                    return postMessage(`@${playerName}`, `Your role is: ${slot.name}.`);
                });
        }));
}

function changePhase(phase: Phase): void {
    updateState({ currentPhase: phase });
    initVotes();

    for (const playerId of state.playerIds) {
        if (state.playerSlots.has(playerId)) {
            state.playerSlots.get(playerId).resetMutableState();
        }
    }
}

function addOrReplaceFormattedAction(action: Action) {
    return Promise.try(() => {
        const abilityDef = abilityFactory(action.abilityType);

        if (!validate(action, state.currentPhase)) {
            throw new Error('You are unable to perform this action.');
        }

        //remove any previous actions by that player of that type
        let dedupers = [action.actor.playerId];

        //factional actions may only be performed by one faction member per night
        if (abilityDef.activationType === AbilityActivationType.Factional) {
            dedupers = _.filter(Array.from(state.playerSlots), ([player, slot]) => slot.alignment === action.actor.alignment)
                .map(([player, slot]) => player);
        }

        // remove action overwritten by the new one received if any
        _(state.currentActions)
            .remove(currentAction => action.abilityType === currentAction.abilityType && _(dedupers).includes(currentAction.actor.playerId))
            .value();

        // add new action
        updateState({
            currentActions: state.currentActions
                .concat([action])
                .sort((a, b) => a.abilityType - b.abilityType)
        });

        if (state.factionChannels.has(action.actor.alignment)) {
            return Promise.all([
                action,
                getUserNameFromId(action.actor.playerId),
                action.target ? getUserNameFromId(action.target.playerId) : null
            ])
                .then(([action, playerName, targetName]) => {
                    return postMessage(
                        state.factionChannels.get(action.actor.alignment),
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
    return Array.from(state.currentVotes.entries()).reduce((acc, [voteeId, votes]) => {
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
    return Array.from(state.playerSlots.values()).filter(slot => slot.isAlive);
}

function getLivingPlayerCount(): number {
    return getLivingPlayers().length;
}

function initVotes(): void {
    const livingPlayerIdsUnordered = getLivingPlayers().map(player => player.playerId);
    const livingPlayerIds = state.playerIds.filter(playerId => livingPlayerIdsUnordered.includes(playerId));

    updateState({
        currentVotes: new Map(
            livingPlayerIds.map(playerId => {
                return [playerId, []];
            }).concat([
                [NOT_VOTING_NAME, livingPlayerIds],
                [NO_LYNCH_NAME, []]
            ]) as Array<[string, string[]]>
        )
    });
}

function getActionsForFaction(faction: Alignment): Action[] {
    return state.currentActions.filter(action => {
        return action.actor.alignment === faction;
    });
}

function endNight() {
    const passivesToApply = [];
    Array.from(state.playerSlots.values()).forEach(slot => {
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
            return Promise.each(state.currentActions, action => {
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

            changePhase({ time: TimeOfDay.Day, num: state.currentPhase.num + 1 });
            return postPublicMessage(`It is now Day ${state.currentPhase.num}`)
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
    const winners = Array.from(state.playerSlots.values()).filter(slot => slot.alignment === victor);

    return getUserIdToNameMap()
        .then(idToNameMap => {
            let message = [`The game has ended. The ${AlignmentAttributesMap.get(victor).name}, consisting of:`];
            message = message.concat(winners.map(winner => idToNameMap.get(winner.playerId)));
            message.push(`has won!`);
            reset();
            return postPublicMessage(message.join('\n'));
        });
}