import { Slot } from '../slot';
import { AbilityActivationType } from '../../constants';
import bot from '../../comm/bot';

export default {
    activationType: AbilityActivationType.Active,

    resolve(actor: Slot, target: Slot): void {
        bot.postMessageToUser(actor.playerId, `${bot.getUserById(target.playerId).name} is aligned with the ${target.alignment}`);
    }
};