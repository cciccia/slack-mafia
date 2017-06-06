module.exports = {
    app: `postgres://${process.env.APP_DB_USER}:${process.env.APP_DB_PASSWORD}@${process.env.APP_DB_HOST}/${process.env.APP_DB_DATABASE}`,
    root: `postgres://${process.env.ROOT_DB_USER}@${process.env.ROOT_DB_HOST}/${process.env.ROOT_DB_DATABASE}`
};