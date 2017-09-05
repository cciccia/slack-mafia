import { Slot } from '../slot';
import { AbilityActivationType, AlignmentAttributesMap } from '../../constants';
import bot from '../../comm/bot';

export default {
    activationType: AbilityActivationType.Active,

    resolve(actor: Slot, target: Slot): void {
        return bot.getUserById(target.playerId)
            .then(p => {
                return bot.postMessageToUserById(
                    actor.playerId,
                    `${p.name} is aligned with the ${AlignmentAttributesMap.get(target.alignment).name}`
                );
            });
    }
};