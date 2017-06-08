import { Ability } from '../ability';
import { Slot } from '../slot';

export class Doctor extends Ability {
    resolve(actor: Slot, target: Slot): void {
        if (!target.isProtectImmune) {
            target.isProtected = true;
        }
    }
}