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
    voteeName?: string;
}

const NOT_VOTING: string = 'Not Voting';
const NO_LYNCH_NAME: string = 'no lynch';
const NO_LYNCH_DISP: string = 'No Lynch';

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
                return bot.postPublicMessage(`Setup was changed to ${currentSetup[':name']} (${currentSetup[':slots'].length} players)`);
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

export function doVoteCount() {
    const vc = getVc();
    const message: string[] = ['Votecount:'];

    const livingPlayers = getLivingPlayerCount();
    const halfPlusOne = Math.floor(livingPlayers / 2) + 1;

    return getPlayerUserMap()
        .then(userMap => {
            vc.forEach(([voteeId, votes]) => {
                if (voteeId === NOT_VOTING) {
                    message.push([
                        `[${votes.length}] ${NOT_VOTING}: `,
                        `(${votes.map(vote => userMap.get(vote).name).join(', ')})`
                    ].join(''));
                } else if (voteeId === NO_LYNCH_NAME) {
                    message.push([
                        `[${votes.length}] ${NO_LYNCH_DISP}: `,
                        `(${votes.map(vote => userMap.get(vote).name).join(', ')})`
                    ].join(''));
                } else {
                    message.push([
                        `[${votes.length}] ${userMap.get(voteeId).name}: `,
                        `(${votes.map(vote => userMap.get(vote).name).join(', ')})`
                    ].join(''));
                }
            });

            message.push('');
            message.push(`With ${getLivingPlayerCount()} alive, it is ${halfPlusOne} to lynch.`);

            return bot.postPublicMessage(message.join('\n'));
        });
}

export function addOrReplaceAction(actorId: string, actionName: string, targetName: string) {
    requirePlaying(actorId);

    return getPlayerUserMap()
        .then(userMap => {

            let targetId;
            const target = Array.from(userMap.values()).find(user => user.name === targetName.toLowerCase());
            if (target) {
                targetId = target.id;
            }

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
    requirePlaying(voterId);

    if (currentPhase.time !== TimeOfDay.Day) {
        throw new Error("You cannot vote right now.");
    }

    return getPlayerUserMap()
        .then(userMap => {
            let voteeId;

            if (!voteeName) {
                voteeId = NOT_VOTING;
            } else if (voteeName.toLowerCase() === NO_LYNCH_NAME) {
                voteeId = NO_LYNCH_NAME;
            } else {
                const votee = Array.from(userMap.values()).find(user => user.name === voteeName.toLowerCase());
                if (votee) {
                    voteeId = votee.id;
                }
                const livingPlayers = getLivingPlayers();
                if (!voteeId || !livingPlayers.find(livingPlayer => livingPlayer.playerId === voteeId)) {
                    throw new Error(`No player ${voteeName} is currently playing and alive.`);
                }
            }

            for (const [votee, votes] of currentVotes) {
                const idx = votes.indexOf(voterId);
                if (idx > -1) {
                    votes.splice(idx, 1);
                }
            }

            currentVotes.get(voteeId).push(voterId);

            if (voteeId === NOT_VOTING) {
                return Promise.all([
                    userMap, bot.postPublicMessage(`${userMap.get(voterId).name} is no longer voting.`)
                ]);
            } else if (voteeId === NO_LYNCH_NAME) {
                return Promise.all([
                    userMap, bot.postPublicMessage(`${userMap.get(voterId).name} is now voting ${NO_LYNCH_DISP}.`)
                ]);
            } else {
                return Promise.all([
                    userMap,
                    bot.postPublicMessage(`${userMap.get(voterId).name} is now voting ${userMap.get(voteeId).name}.`)
                ]);
            }
        })
        .then(([userMap, _]) => {
            const vc = getVc();
            const halfPlus1 = Math.floor(getLivingPlayerCount() / 2) + 1;

            const [lyncheeId, votesToLynch] = vc.find(([voteeId, votes]) => votes.length >= halfPlus1);

            //a lynch has been reached.

            if (lyncheeId && (lyncheeId !== NOT_VOTING)) {
                const message: string[] = [];

                if (lyncheeId !== NO_LYNCH_NAME) {
                    const slot = playerSlots.get(lyncheeId);
                    slot.die();

                    const victor = isGameOver();
                    if (victor != null) {
                        return endGame(victor);
                    }
                    message.push(`${userMap.get(lyncheeId).name} was lynched. They were a ${slot.name}.`);
                    message.push(`It is now Night ${currentPhase.num}. Night will last ${process.env.NIGHT_LENGTH} seconds.`);
                } else {
                    message.push(`No one was lynched.`);
                    message.push(`It is now Night ${currentPhase.num}. Night will last ${process.env.NIGHT_LENGTH} seconds.`);
                }
                changePhase({ time: TimeOfDay.Night, num: currentPhase.num });
                nightEndTimeout = setTimeout(endNight, parseInt(process.env.NIGHT_LENGTH, 10) * 1000);

                return bot.postPublicMessage(message.join('\n'));
            }
        });
}


// other public getter/setters
export function reset(): void {
    if (nightEndTimeout) {
        clearTimeout(nightEndTimeout);
    }

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

export function getPhase(): Phase {
    return currentPhase;
}



// private module methods
function requirePlaying(playerId: string): void {
    if (!playerSlots.has(playerId)) {
        throw new Error('You are not currently playing!');
    }
}

function getPlayerUserMap(): Promise<Map<string, any>> {
    return Promise.all(playerIds.map(playerId => bot.getUserById(playerId)))
        .then(users => users.reduce((acc, user) => {
            acc.set(user.id, user);
            return acc;
        }, new Map<string, any>()));
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
            return bot.postPublicMessage(`It is now Day 1.`)
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
    });
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

    currentVotes.set(NOT_VOTING, []);
    currentVotes.set(NO_LYNCH_NAME, []);

    livingPlayerIds.forEach(playerId => {
        currentVotes.get(NOT_VOTING).push(playerId);
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
            return Promise.all(currentActions.map(action => {
                const ability = abilityFactory(action.abilityType);
                action.actor.consumeAbility(action.abilityType);
                return Promise.resolve(ability.resolve(action.actor, action.target));
            }));
        })
        .then(() => {
            const victor = isGameOver();
            if (victor != null) {
                return endGame(victor);
            }

            changePhase({ time: TimeOfDay.Day, num: currentPhase.num + 1 });
            return bot.postPublicMessage(`It is now Day ${currentPhase.num}`)
                .then(() => {
                    initVotes();
                    doVoteCount();
                });
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

    return getPlayerUserMap()
        .then(userMap => {
            let message = [`The game has ended. The ${AlignmentAttributesMap.get(victor).name}, consisting of:`];
            message = message.concat(winners.map(winner => userMap.get(winner.playerId).name));
            message.push(`has won!`);
            reset();
            return bot.postPublicMessage(message.join('\n'));
        });
}