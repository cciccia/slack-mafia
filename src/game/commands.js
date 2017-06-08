import { Action, validate } from './ability';
import { Vote, addPlayer, addAction, getPhase, setVote } from './gamestate';

// A user has joined.
export const SubmitJoin = (player: string) => {
    addPlayer(player);
}

// A user has voted.
export const SubmitVote = (vote: Vote) => {
    setVote(vote);
}

// A Night Action was Submitted.  Process, and feed back to the uder if it is valid or invalid.
export const SubmitAction = (action: Action) => {
    //todo: add messaging to user
    if (validate(action, getPhase())) {
        addAction(action);
    } else {
        
    }
}