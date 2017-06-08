import { TimeOfDay } from '../constants';
import { Action } from './ability';

export interface Phase {
    time: TimeOfDay,
    num: number
}

export let currentPhase: Phase;

export let currentActions: Action[];

export let currentMessages: string[];