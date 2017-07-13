import { getEdn } from '../utils';
const edn = getEdn();

const fs = require('fs');

export function listSetups() {
    try {
        const setups = edn.parse(fs.readFileSync('./resources/setups.edn', 'utf8'));
        console.log(`Listing all available setups:`);
        setups.each(setup => {
            console.log(`--------------------------------------`);
            console.log(`Name: ${setup.at(edn.kw(':name'))}`);
            console.log(`Slots: `);
            setup.at(edn.kw(':slots')).each(slot => {
                console.log(`\t${slot.at(edn.kw(':name'))}`);
            });
            console.log(`To play, type "!setup ${setup.at(edn.kw(':tag'))}"`);
            console.log(`--------------------------------------`);
        });
    } catch (e) {
        console.error(`Error: Missing or malformed setup configuration file found at resources/setups.edn`);
    }
}

export function getSetup(tag: string) {
    try {
        const setups = edn.parse(fs.readFileSync('./resources/setups.edn', 'utf8'));
        let match;
        setups.each(setup => {
            const curTag = setup.at(edn.kw(':tag'));
            if (tag === curTag) {
                match = setup;
            }
        });
        return match;
    } catch (e) {
        throw `Error: Missing or malformed setup configuration file found at resources/setups.edn`;
    }
}