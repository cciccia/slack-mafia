import { Slot } from '../slot';
import bot from '../../comm/bot';

export default {
    resolve(actor: Slot, target: Slot): void {
        bot.postMessageToUser(actor.playerId, `${bot.getUserById(target.playerId).name} is aligned with the ${target.alignment}`);
    }
};