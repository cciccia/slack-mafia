import * as bodyParser from "body-parser";
import * as express from "express";

import commandRouter from './routes/command';
import logger from './logger';

class Server {

    public app: express.Application;

    public static bootstrap(): Server {
        return new Server();
    }

    constructor() {
        this.app = express();
        this.config();
        this.routes();
    }

    public routes(): void {
        this.app.use('/api/v1/commands', commandRouter);
    }

    public config() {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(function(err, req, res, next) {
            logger.error(err.stack);
            res.status(500).send('An error has occurred.');
        });
    }
}

export default new Server().app;