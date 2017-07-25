import { Action, validate } from './ability';
import { Vote, setSetup, addPlayer, removePlayer, addOrReplaceAction, getPhase, setVote, doVoteCount } from './gamestate';

/**
*
* This is the public API for the messaging portion of the app to communicate w/ the game portion of the app
*
**/

export const SetSetup = (tag: string) => {
    setSetup(tag);
};

// A user has joined.
export const JoinGame = (playerId: string): boolean => {
    return addPlayer(playerId);
};

// A user has unjoined before game has started.
export const UnJoinGame = (playerId: string) => {
    removePlayer(playerId);
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
