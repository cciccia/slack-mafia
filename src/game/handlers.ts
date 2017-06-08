import { Action, abilityFactory, validate } from './ability';
import { SyncEvent } from 'ts-events';
import { currentPhase, currentActions } from './gamestate';

export const ProcessActionEvent = new SyncEvent<Action>();
ProcessActionEvent.attach((action: Action) => {
    if (validate(action, currentPhase)) {
        currentActions.push(action);
    }
});

export const ExecuteResolutionsEvent = new SyncEvent<void>();
ExecuteResolutionsEvent.attach(() => {
    const sortedActions = currentActions.sort((a, b) => {
        return a.abilityType - b.abilityType;
    });

    sortedActions.forEach(action => {
        const ability = abilityFactory(action.abilityType);
        action.actor.consumeAbility(action.abilityType);
        ability.resolve(action.actor, action.target);
    });
});