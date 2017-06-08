const promise = require('bluebird');
const options = {
    promiseLib: promise
};
const pgp = require('pg-promise')(options);
const connection = require('../src/db/connection');

const connObject = {
    user: connection.root.username,
    host: connection.root.host,
    database: connection.root.database,
    port: 5432
}

const db = pgp(connObject);

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