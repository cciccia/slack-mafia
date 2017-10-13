import { Slot } from '../slot';
import { AbilityActivationType, AlignmentAttributesMap } from '../../constants';
import { postMessage, getUserNameFromId } from '../../comm/restCommands';

export default {
    activationType: AbilityActivationType.Active,

    resolve(actor: Slot, target: Slot) {
        if (!actor.isRoleblocked) {
            return getUserNameFromId(target.playerId)
                .then(playerName => {
                    return postMessage(
                        `@${playerName}`,
                        `${playerName} is aligned with the ${AlignmentAttributesMap.get(target.alignment).name}`
                    );
                });
        }
    }
};