export const enum ParityType {
    Any = 1,
    Even,
    Odd
}

// this enum's order is important -- earlier entries have higher priority than later ones
export const enum AbilityType {
    //passive abilities should generally all resolve first (i think)
    Macho,

    //active abilities
    Doctor,
    FactionalKill,
    Cop
}

export const enum Alignment {
    Town = 1,
    Mafia
}

export const enum TimeOfDay {
    Night = 1,
    Day,
    WaitingForPlayers,
    Pregame,
    Postgame
}