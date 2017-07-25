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
                res.sendStatus(401);
            }
            next();
        });

        this.router.post('/in', this.joinGame);
    }

    joinGame(req: Request, res: Response) {
        const playerId = req.body.user_id;
        const result = gameCommands.JoinGame(playerId);

        if (result) {
            res.json({ text: 'You are now signed up!' });
        } else {
            res.json({ text: 'You are already signed up!' });
        }
    }
}

const commandRoutes = new CommandRouter();
commandRoutes.init();

export default commandRoutes.router;