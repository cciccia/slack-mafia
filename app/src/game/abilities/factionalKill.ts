import { Slot } from '../slot';
import { AbilityActivationType } from '../../constants';
import bot from '../../comm/bot';

export default {
    activationType: AbilityActivationType.Factional,

    resolve(actor: Slot, target: Slot): void {
        if (!target.isProtected) {
            target.die();
            return bot.getUserById(target.playerId)
                .then(p => {
                    return bot.postPublicMessage(`${p.name} was killed. They were a ${target.name}.`);
                });
        }
    }
};