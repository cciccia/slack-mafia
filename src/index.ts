import { getEdn } from './utils';

const fs = require('fs');
const edn = getEdn();

console.log(`Running enviroment ${process.env.NODE_ENV}. Hello world.`);

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