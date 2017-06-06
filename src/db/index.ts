'use strict';

interface Db {
    Sequelize: any;
    sequelize: any;
}

import { Sequelize } from 'sequelize-typescript';

const fs = require('fs');
const path = require('path');
const basename = path.basename(module.filename);
const env = process.env.NODE_ENV || 'development';

const app_config = require(__dirname + '/connection').app;

const sequelize = new Sequelize(Object.assign({
    modelPaths: [__dirname + '/models']
}, app_config));

const db: Db = {
    sequelize,
    Sequelize
};

export default db;
