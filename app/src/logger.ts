import * as winston from 'winston';

export default new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ level: process.env.LOG_LEVEL }),
        new (winston.transports.File)({
            filename: 'error.log',
            level: 'error'
        })
    ]
});