module.exports = {
    app: {
        username: process.env.APP_DB_USER,
        password: process.env.APP_DB_PASSWORD,
        name: process.env.APP_DB_DATABASE,
        host: process.env.APP_DB_HOST,
        dialect: 'postgres'
    },
    root: {
        username: process.env.ROOT_DB_USER,
        password: '',
        name: process.env.ROOT_DB_DATABASE,
        host: process.env.ROOT_DB_HOST,
        dialect: 'postgres'
    }
}