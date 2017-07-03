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

const conn = require(__dirname + '/config/config')[env];

const sequelize = new Sequelize(Object.assign({
    modelPaths: [__dirname + '/models'],
}, conn));

const db: Db = {
    sequelize,
    Sequelize
};

export default db;
