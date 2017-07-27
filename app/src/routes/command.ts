import { Router, Request, Response, NextFunction } from 'express';

import * as gameCommands from '../game/commands';

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
    }

    joinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;
        const result = gameCommands.JoinGame(playerId);

        res.json({ text: result });
    }

    unJoinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;
        const result = gameCommands.UnJoinGame(playerId);

        res.json({ text: result });
    }
}

const commandRoutes = new CommandRouter();
commandRoutes.init();

export default commandRoutes.router;