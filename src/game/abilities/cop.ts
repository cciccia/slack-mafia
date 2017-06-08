import { Ability } from '../ability';
import { Slot } from '../slot';
import { addMessage } from '../gamestate';

export class Cop extends Ability {
    resolve(actor: Slot, target: Slot): void {
        addMessage({
            recipient: actor.player,
            message: `${target.player} is aligned with the ${target.alignment}`
        });
    }
}