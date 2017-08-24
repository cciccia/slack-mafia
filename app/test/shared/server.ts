import * as http from 'http';
import app from '../../src/server';
import * as Promise from 'bluebird';

export default new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(3000);
    server.on('listening', () => {
        console.log('Express is listening on port 3000.');
        resolve();
    });
});