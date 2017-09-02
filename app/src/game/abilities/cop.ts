import { Slot } from '../slot';
import { AbilityActivationType } from '../../constants';
import bot from '../../comm/bot';

export default {
    activationType: AbilityActivationType.Active,

    resolve(actor: Slot, target: Slot): void {
        bot.getUserById(target.playerId)
            .then(p => {
                bot.postMessageToUserById(actor.playerId, `${p.name} is aligned with the ${target.alignment}`);
            });
    }
};