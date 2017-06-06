import db from './db/index';

import Setup from './db/models/setup';

console.log(`Running enviroment ${process.env.NODE_ENV}. Hello world.`);

db.sequelize.sync({ force: true })
    .then(() => {
        return Setup.findAll<Setup>().then(setups => {
            console.log('Listing all available setups');
            console.log(setups);
        });
    })
    .catch(err => {
        console.log(err);
    });