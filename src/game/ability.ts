import { CycleType, AbilityType, TimeOfDay } from '../constants';
import { Phase } from './gamestate';
import { Slot } from './slot';
import { Cop } from './abilities/cop';

export interface AbilityUsage {
    charges?: number;
    day?: CycleType;
    time: TimeOfDay;
}

export interface AbilityInstance {
    abilityType: AbilityType;
    usage: AbilityUsage
}

export abstract class Ability {
    abstract resolve(actor: Slot, target: Slot): void;
}

export function abilityFactory(abilityType: AbilityType) {
    switch (abilityType) {
        case AbilityType.Cop:
            return new Cop();
        default:
            throw "Bad stop";
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
            && !(phase.num % 2 == 0 && ability.usage.day === CycleType.Odd)
            && !(phase.num % 2 == 1 && ability.usage.day === CycleType.Even)
            && !(phase.time !== ability.usage.time)
    })) {
        return false;
    }

    return true;
};

export interface Action {
    actor: Slot,
    target?: Slot,
    abilityType: AbilityType
}