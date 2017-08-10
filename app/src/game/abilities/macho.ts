import { Slot } from '../slot';
import { AbilityActivationType } from '../../constants';

export default {
    activationType: AbilityActivationType.Passive,

    resolve(actor: Slot, target: Slot): void {
        target.isProtectImmune = true;
    }
};