import { Slot } from '../slot';
import bot from '../../comm/bot';

export default {
    resolve(actor: Slot, target: Slot): void {
        if (!target.isProtected) {
            target.die();
            bot.postMessage(`${bot.getUserById(target.playerId).name} was killed. They were a ${target.name}.`);
        }
    }
};