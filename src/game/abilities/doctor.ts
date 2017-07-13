import { Slot } from '../slot';

export default {
    resolve(actor: Slot, target: Slot): void {
        if (!target.isProtectImmune) {
            target.isProtected = true;
        }
    }
};