const promise = require('bluebird');
const options = {
    promiseLib: promise
};
const pgp = require('pg-promise')(options);
const connection = require('./connection');
const db = pgp(connection);

db.none(`DROP DATABASE IF EXISTS ${process.env.APP_DB_DATABASE}`)
    .then(() => {
        return db.none(`CREATE DATABASE ${process.env.APP_DB_DATABASE}`);
    })
    .then(() => {
        return db.none(`ALTER DATABASE ${process.env.APP_DB_DATABASE} OWNER TO ${process.env.APP_DB_USER}`);
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => {
        pgp.end();
    });