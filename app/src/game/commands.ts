import { Action, validate } from './ability';
import { Vote, setSetup, addPlayer, removePlayer, addOrReplaceAction, getPhase, setVote, doVoteCount } from './gamestate';

import bot from '../comm/bot';

/**
*
* This is the public API for the messaging portion of the app to communicate w/ the game portion of the app
*
**/

export const SetSetup = (tag: string) => {
    try {
        const setup = setSetup(tag);
        bot.postPublicMessage(`Setup was changed to ${setup[':name']} (${setup[':slots'].length} players)`);

        return 'Setup changed!';
    } catch (e) {
        return e.message;
    }
};

// A user has joined.
export const JoinGame = (playerId: string): string => {
    try {
        addPlayer(playerId);
        bot.getUserById(playerId)
            .then(player => {
                bot.postPublicMessage(`${player.name} has joined.`);
            });
        return 'You are now signed up!';
    } catch (e) {
        return e.message;
    }
};

// A user has unjoined before game has started.
export const UnJoinGame = (playerId: string): string => {
    try {
        removePlayer(playerId);
        bot.getUserById(playerId)
            .then(player => {
                bot.postPublicMessage(`${player.name} has left.`);
            });
        return 'You are no longer signed up!';
    } catch (e) {
        return e.message;
    }
};

// A user has voted.
export const MakeVote = (vote: Vote) => {
    setVote(vote);
};

// A Night Action was Submitted.  Process, and feed back to the uder (udder?) if it is valid or invalid.
export const SubmitAction = (action: Action) => {
    //todo: add messaging to user
    if (validate(action, getPhase())) {
        addOrReplaceAction(action);
    } else {

    }
};

export const VoteCount = () => {
    return doVoteCount();
};
