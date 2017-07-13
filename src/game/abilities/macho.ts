import { Slot } from '../slot';

export default {
    resolve(actor: Slot, target: Slot): void {
        target.isProtectImmune = true;
    }
};