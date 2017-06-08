import { Ability } from '../ability';
import { Slot } from '../slot';

export class Macho extends Ability {
    resolve(actor: Slot, target: Slot): void {
        target.isProtectImmune = true;
    }
}