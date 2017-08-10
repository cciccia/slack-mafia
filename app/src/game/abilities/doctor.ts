import { Slot } from '../slot';
import { AbilityActivationType } from '../../constants';

export default {
    activationType: AbilityActivationType.Active,

    resolve(actor: Slot, target: Slot): void {
        if (!target.isProtectImmune) {
            target.isProtected = true;
        }
    }
};