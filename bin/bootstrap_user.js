const promise = require('bluebird');
const options = {
    promiseLib: promise
};
const pgp = require('pg-promise')(options);
const connection = require('./connection');
const db = pgp(connection);

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