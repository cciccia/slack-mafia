import { ParityType, AbilityType, TimeOfDay } from '../constants';
import { Phase } from './gamestate';
import { Slot } from './slot';


import Cop from './abilities/cop';
import Doctor from './abilities/doctor';
import FactionalKill from './abilities/factionalKill';
import Macho from './abilities/macho';


export interface AbilityUsage {
    charges: number;
    parity: ParityType;
    time: TimeOfDay;
}

export interface AbilityInstance {
    abilityType: AbilityType;
    usage: AbilityUsage;
}

const actionMapDef = {
    investigate: AbilityType.Cop,
    protect: AbilityType.Doctor,
    kill: AbilityType.FactionalKill
};

const actionMap = new Map<String, AbilityType>(Object.entries(actionMapDef));

export function actionResolver(actionName: String): AbilityType {
    if (!actionMap.has(actionName)) {
        throw new Error(`Action ${actionName} was not recognized.`);
    }

    return actionMap.get(actionName);
}

export function actionDescriber(abilityType: AbilityType) {
    let verb;

    for (const [key, value] of actionMap.entries()) {
        if (value === abilityType) {
            verb = key;
            break;
        }
    }

    return verb;
}

export function abilityFactory(abilityType: AbilityType) {
    switch (abilityType) {
        case AbilityType.Cop:
            return Cop;
        case AbilityType.Doctor:
            return Doctor;
        case AbilityType.FactionalKill:
            return FactionalKill;
        case AbilityType.Macho:
            return Macho;
        default:
            throw new Error(`No ability definition found for ${abilityType}`);
    }
}

export function validate({ actor, abilityType, target }: Action, phase: Phase) {
    //actor is dead
    if (!actor.isAlive) {
        return false;
    }

    //actor is target
    if (actor === target) {
        return false;
    }

    //actor does not have ability or it is out of charges or it cannot be used right now
    if (!actor.abilities.some((ability: AbilityInstance) => {
        return ability.abilityType === abilityType
            && ability.usage.charges !== 0
            && !(phase.num % 2 === 0 && ability.usage.parity === ParityType.Odd)
            && !(phase.num % 2 === 1 && ability.usage.parity === ParityType.Even)
            && !(phase.time !== ability.usage.time);
    })) {
        return false;
    }

    return true;
}

export interface Action {
    actor: Slot;
    target?: Slot;
    abilityType: AbilityType;
}