import { Slot } from '../slot';
import { AbilityActivationType } from '../../constants';
import { postPublicMessage, getUserNameFromId } from '../../comm/restCommands';

export default {
    activationType: AbilityActivationType.Factional,

    resolve(actor: Slot, target: Slot) {
        if (!actor.isRoleblocked && !target.isProtected) {
            target.die();
            return getUserNameFromId(target.playerId)
                .then(playerName => {
                    return postPublicMessage(`${playerName} was killed. They were a ${target.name}.`);
                });
        }
    }
};