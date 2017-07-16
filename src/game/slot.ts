import { AbilityInstance } from './ability';
import { Alignment, AbilityType } from '../constants';

export class Slot {
    // immutable state
    readonly playerId: string;
    readonly name: string;
    readonly alignment: Alignment;
    readonly abilities: AbilityInstance[];

    // mutable, permanent state
    isAlive: boolean = true;
    isPermanentlyUnprotectable: boolean = false;

    // mutable, temporary state
    isProtected: boolean = false;
    isProtectImmune: boolean = false;

    constructor(playerId: string, name: string, alignment: Alignment, abilities: AbilityInstance[]) {
        this.playerId = playerId;
        this.name = name;
        this.alignment = alignment;
        this.abilities = abilities;
    }

    resetMutableState(): void {
        this.isProtected = false;
        this.isProtectImmune = false;
    }

    die(): void {
        this.isAlive = false;
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