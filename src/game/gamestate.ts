import { TimeOfDay } from '../constants';
import { Action } from './ability';
import { Slot } from './slot';

export interface Phase {
    time: TimeOfDay;
    num: number;
}

export let currentPhase: Phase;

export let currentActions: Action[];

export let currentMessages: string[];

export let slots: Slot[];

export function init() {

}