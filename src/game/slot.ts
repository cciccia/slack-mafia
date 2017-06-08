import { AbilityInstance } from './ability';
import { Alignment, AbilityType } from '../constants';

export class Slot {
    // immutable state
    readonly player: string;
    readonly alignment: Alignment;
    readonly abilities: AbilityInstance[];

    // mutable, permanent state
    isAlive: boolean = true;
    isPermanentlyUnprotectable: boolean = false;

    // mutable, temporary state
    isProtected: boolean = false;
    isProtectImmune: boolean = false;

    constructor(player: string, alignment: Alignment, abilities: AbilityInstance[]) {
        this.player = player;
        this.alignment = alignment;
        this.abilities = abilities;
    }

    reset(): void {
        this.isProtected = false;
        this.isProtectImmune = false;
    }

    consumeAbility(myAbilityType: AbilityType) {
        const myAbilityInstance = this.abilities.find(abilityInstance => {
            return abilityInstance.abilityType === myAbilityType;
        });

        if (myAbilityInstance.usage.charges > 0) {
            myAbilityInstance.usage.charges--;
        }
    }
}