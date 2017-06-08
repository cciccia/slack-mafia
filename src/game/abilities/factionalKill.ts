import { Ability } from '../ability';
import { Slot } from '../slot';

export class FactionalKill extends Ability {
    resolve(actor: Slot, target: Slot): void {
        if (!target.isProtected) {
            target.isAlive = false;
        }
    }
}