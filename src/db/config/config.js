module.exports = {
    development: {
        username: process.env.APP_DB_USER,
        password: process.env.APP_DB_PASSWORD,
        name: process.env.APP_DB_DATABASE,
        host: process.env.APP_DB_HOST,
        dialect: process.env.APP_DB_DIALECT
    }
}
