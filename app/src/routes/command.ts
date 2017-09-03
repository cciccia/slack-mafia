import { Router, Request, Response, NextFunction } from 'express';
import * as Promise from 'bluebird';
import * as channels from 'channels';

import logger from '../logger';
import bot from '../comm/bot';
import { Vote, setSetup, addPlayer, removePlayer, addOrReplaceAction, getPhase, setVote, doVoteCount } from '../game/gamestate';

class CommandRouter {
    router: Router;
    chan: any;

    constructor() {
        this.router = Router();
        this.chan = new channels.channels(this.processAction);
        this.init();
    }

    processAction({ handler, req, res }, done) {
        handler(req, res)
            .then(() => {
                done();
            });
    }

    registerEmitter(handler) {
        return (req: Request, res: Response) => {
            this.chan.emit('actionProcessor', { handler, req, res });
        };
    }

    init() {
        this.router.use((req: Request, res: Response, next: NextFunction) => {
            const body = req.body;

            if (body.token !== process.env.SLACK_VERIFICATION_TOKEN) {
                return res.sendStatus(401);
            }
            next();
        });

        this.router.post('/in', this.registerEmitter(this.joinGame));
        this.router.post('/out', this.registerEmitter(this.unJoinGame));
        this.router.post('/setup', this.registerEmitter(this.setSetup));
        this.router.post('/vote', this.registerEmitter(this.makeVote));
        this.router.post('/unvote', this.registerEmitter(this.makeUnvote));
        this.router.post('/act', this.registerEmitter(this.submitAction));
        this.router.post('/vc', this.registerEmitter(this.requestVotecount));
    }

    joinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;

        return Promise.try(() => {
            addPlayer(playerId);
            bot.getUserById(playerId)
                .then(player => {
                    bot.postPublicMessage(`${player.name} has joined.`);
                });
            res.json({ text: 'You are now signed up!' });
        }).catch(e => {
            res.json({ text: e.message });
        });
    }

    unJoinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;

        return Promise.try(() => {
            removePlayer(playerId);
            bot.getUserById(playerId)
                .then(player => {
                    bot.postPublicMessage(`${player.name} has left.`);
                });
            res.json({ text: 'You are no longer signed up!' });
        }).catch(e => {
            res.json({ text: e.message });
        });
    }

    setSetup(req: Request, res: Response) {
        const setupTag = req.body.text;

        return Promise.try(() => {
            const setup = setSetup(setupTag);
            bot.postPublicMessage(`Setup was changed to ${setup[':name']} (${setup[':slots'].length} players)`);

            res.json({ text: 'Setup changed!' });
        }).catch(e => {
            res.json({ text: e.message });
        });
    }

    makeVote(req: Request, res: Response) {
        const voterId = req.body.user_id;
        const voterName = req.body.user_name;
        const voteeName = req.body.text;

        return bot.getUserId(voteeName)
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

        return Promise.try(() => {
            setVote({ voterId });
            bot.postPublicMessage(`${voterName} is no longer voting.`);
            res.json({ text: "Vote cleared!" });
        }).catch(e => {
            res.json({ text: e.message });
        });
    }

    submitAction(req: Request, res: Response) {
        const actorId = req.body.user_id;
        const actorName = req.body.user_name;
        const [actionName, targetName] = req.body.text.split(' ');

        return Promise.try(() => targetName ? bot.getUserId(targetName) : null)
            .then(targetId => {
                addOrReplaceAction(actorId, actionName, targetId, targetName);
                res.json({ text: "Confirming: ${actionName} on ${targetName}" });
            })
            .catch(e => {
                res.json({ text: e.message });
            });
    }

    requestVotecount(req: Request, res: Response) {
        return Promise.try(() => {
            doVoteCount();
            res.json({ text: "Ok!" });
        }).catch(e => {
            res.json({ text: e.message });
        });
    }
}

const commandRoutes = new CommandRouter();
commandRoutes.init();

export default commandRoutes.router;