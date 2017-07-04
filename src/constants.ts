export enum ParityType {
    Any,
    Even,
    Odd
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

export enum TimeOfDay {
    Night,
    Day,
    WaitingForPlayers,
    Pregame,
    Postgame
}