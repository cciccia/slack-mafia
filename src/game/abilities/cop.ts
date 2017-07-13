import { Slot } from '../slot';
import { addMessage } from '../gamestate';

export default {
    resolve(actor: Slot, target: Slot): void {
        addMessage({
            recipient: actor.player,
            message: `${target.player} is aligned with the ${target.alignment}`
        });
    }
};