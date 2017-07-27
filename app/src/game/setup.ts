import { getEdn } from '../utils';
const edn = getEdn();

const fs = require('fs');

export function listSetups() {
    try {
        const setups = edn.parse(fs.readFileSync('./resources/setups.edn', 'utf8')).jsEncode();
        console.log(`Listing all available setups:`);
        setups.forEach(setup => {
            console.log(`--------------------------------------`);
            console.log(`Name: ${setup[':name']}`);
            console.log(`Slots: `);
            setup[':slots'].forEach(slot => {
                console.log(`\t${slot[':name']}`);
            });
            console.log(`To play, type "!setup ${setup[':tag']}"`);
            console.log(`--------------------------------------`);
        });
    } catch (e) {
        console.error(`Error: Missing or malformed setup configuration file found at resources/ setups.edn`);
    }
}

export function getFirstSetup() {
    const setups = edn.parse(fs.readFileSync('./resources/setups.edn', 'utf8')).jsEncode();
    return setups[0];
}

export function getSetup(tag: string) {
    try {
        const setups = edn.parse(fs.readFileSync('./resources/setups.edn', 'utf8')).jsEncode();
        return setups.find(setup => {
            return tag === setup[':tag'];
        });
    } catch (e) {
        throw new Error(`Error: Missing or malformed setup configuration file found at resources/ setups.edn`);
    }
}