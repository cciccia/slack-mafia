import { getEdn } from '../utils';
const edn = getEdn();

const fs = require('fs');
const path = require('path');

import { AbilityInstance } from './ability';
import { Alignment, ParityType, TimeOfDay } from '../constants';

export interface SlotSpec {
    name: string;
    alignment: Alignment;
    abilities: Array<AbilityInstance>;
}

export interface Setup {
    name: string;
    tag: string;
    slots: Array<SlotSpec>;
}

function deserialize(jsSetup): Setup {
    return {
        name: jsSetup[':name'],
        tag: jsSetup[':tag'],
        slots: jsSetup[':slots'].map(slot => ({
            name: slot[':name'],
            alignment: slot[':alignment'],
            abilities: slot[':abilities'].map(ability => ({
                abilityType: ability[':ability-type'],
                usage: {
                    charges: (ability[':usage'] && ability[':usage'][':charges']) || -1,
                    parity: (ability[':usage'] && ability[':usage'][':parity']) || ParityType.Any,
                    time: (ability[':usage'] && ability[':usage'][':time']) || TimeOfDay.Night
                }
            }))
        }))
    };
}

export function listSetups(): void {
    try {
        const setups = edn.parse(fs.readFileSync(path.join('.', process.env.SETUP_FILE), 'utf8')).jsEncode();
        console.log(`Listing all available setups:`);
        setups.map(deserialize).forEach(setup => {
            console.log(`--------------------------------------`);
            console.log(`Name: ${setup.name}`);
            console.log(`Slots: `);
            setup.slots.forEach(slot => {
                console.log(`\t${slot.name}`);
            });
            console.log(`To play, type "!setup ${setup.tag}"`);
            console.log(`--------------------------------------`);
        });
    } catch (e) {
        console.error(`Error: Missing or malformed setup configuration file found at resources/ setups.edn`);
    }
}

export function getFirstSetup(): Setup {
    const setups = edn.parse(fs.readFileSync(path.join('.', process.env.SETUP_FILE), 'utf8')).jsEncode();
    return deserialize(setups[0]);
}

export function getSetup(tag: string): Setup {
    try {
        const setups = edn.parse(fs.readFileSync(path.join('.', process.env.SETUP_FILE), 'utf8')).jsEncode();
        return deserialize(setups.find(setup => {
            return tag === setup[':tag'];
        }));
    } catch (e) {
        throw new Error(`Error: Missing or malformed setup configuration file found at resources/ setups.edn`);
    }
}