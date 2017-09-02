export enum ParityType {
    Any,
    Even,
    Odd
}

export enum AbilityActivationType {
    Active,
    Passive,
    Factional
}

// this enum's order is important -- earlier entries have higher priority than later ones
export enum AbilityType {
    //passive abilities should generally all resolve first (i think)
    Macho,

    //active abilities
    Doctor,
    FactionalKill,
    Cop
}

export enum Alignment {
    Town,
    Mafia
}

export interface AlignmentAttributes {
    name: string;
    hasFactionalCommunication: boolean;
    hasFactionalKill: boolean;
}

export const AlignmentAttributesMap = new Map<Alignment, AlignmentAttributes>([
    [Alignment.Town, {
        name: 'Town',
        hasFactionalCommunication: false,
        hasFactionalKill: false
    }],
    [Alignment.Mafia, {
        name: 'Mafia',
        hasFactionalCommunication: true,
        hasFactionalKill: true
    }]
]);

export enum TimeOfDay {
    Night,
    Day,
    WaitingForPlayers,
    Pregame,
    Postgame
}