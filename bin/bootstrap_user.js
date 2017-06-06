const promise = require('bluebird');
const options = {
    promiseLib: promise
};
const pgp = require('pg-promise')(options);
const connection = require('../src/db/connection');
const db = pgp(connection.root);

db.none(`DROP USER ${process.env.APP_DB_USER}`)
    .catch(err => {
    })
    .then(() => {
        return db.none(`CREATE USER ${process.env.APP_DB_USER}`);
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => {
        pgp.end();
    });