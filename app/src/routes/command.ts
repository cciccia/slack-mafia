import { Router, Request, Response, NextFunction } from 'express';

import bot from '../comm/bot';
import { Vote, setSetup, addPlayer, removePlayer, addOrReplaceAction, getPhase, setVote, doVoteCount } from '../game/gamestate';

class CommandRouter {
    router: Router;

    constructor() {
        this.router = Router();
        this.init();
    }

    init() {
        this.router.use((req: Request, res: Response, next: NextFunction) => {
            const body = req.body;

            if (body.token !== process.env.SLACK_VERIFICATION_TOKEN) {
                return res.sendStatus(401);
            }
            next();
        });

        this.router.post('/in', this.joinGame);
        this.router.post('/out', this.unJoinGame);
        this.router.post('/setup', this.setSetup);
        this.router.post('/vote', this.makeVote);
        this.router.post('/unvote', this.makeUnvote);
        this.router.post('/act', this.submitAction);
    }

    joinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;

        try {
            addPlayer(playerId);
            bot.getUserById(playerId)
                .then(player => {
                    bot.postPublicMessage(`${player.name} has joined.`);
                });
            res.json({ text: 'You are now signed up!' });
        } catch (e) {
            res.json({ text: e.message });
        }
    }

    unJoinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;

        try {
            removePlayer(playerId);
            bot.getUserById(playerId)
                .then(player => {
                    bot.postPublicMessage(`${player.name} has left.`);
                });
            res.json({ text: 'You are no longer signed up!' });
        } catch (e) {
            res.json({ text: e.message });
        }
    }

    setSetup(req: Request, res: Response) {
        const setupTag = req.body.text;

        try {
            const setup = setSetup(setupTag);
            bot.postPublicMessage(`Setup was changed to ${setup[':name']} (${setup[':slots'].length} players)`);

            res.json({ text: 'Setup changed!' });
        } catch (e) {
            res.json({ text: e.message });
        }
    }

    makeVote(req: Request, res: Response) {
        const voterId = req.body.user_id;
        const voterName = req.body.user_name;
        const voteeName = req.body.text;

        bot.getUserId(voteeName)
            .then(voteeId => {
                setVote({ voterId, voteeId });
                bot.postPublicMessage(`${voterName} is now voting ${voteeName}.`);
                res.json({ text: "Vote set!" });
            })
            .catch(e => {
                res.json({ text: e.message });
            });
    }

    makeUnvote(req: Request, res: Response) {
        const voterId = req.body.user_id;
        const voterName = req.body.user_name;

        try {
            setVote({ voterId });
            bot.postPublicMessage(`${voterName} is no longer voting.`);
            res.json({ text: "Vote cleared!" });
        } catch (e) {
            res.json({ text: e.message });
        }
    }

    submitAction(req: Request, res: Response) {
        const actorId = req.body.user_id;
        const actorName = req.body.user_name;
        const [actionName, targetName] = req.body.text.split(' ');

        const promise = targetName ? bot.getUserId(targetName) : Promise.resolve(null);

        return promise
            .then(targetId => {
                addOrReplaceAction(actorId, actionName, targetId, targetName);
                res.json({ text: "Confirming: ${actionName} on ${targetName}" });
            })
            .catch(e => {
                res.json({ text: e.message });
            });
    }
}

const commandRoutes = new CommandRouter();
commandRoutes.init();

export default commandRoutes.router;