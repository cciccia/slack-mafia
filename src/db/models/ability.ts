import { Table, Column, Model, BelongsTo, ForeignKey } from 'sequelize-typescript';
import Slot from './slot';
import Parity from './parity';
import Time from './time';
import AbilityType from './abilityType';

@Table
class Ability extends Model<Ability> {

    @BelongsTo(() => AbilityType)
    abilityType: AbilityType;

    @ForeignKey(() => AbilityType)
    @Column
    abilityTypeId: number;

    @Column
    charges: number;

    @BelongsTo(() => Parity)
    parity: Parity;

    @ForeignKey(() => Parity)
    @Column
    parityId: number;

    @BelongsTo(() => Time)
    time: Time;

    @ForeignKey(() => Time)
    @Column
    timeId: number;

    @BelongsTo(() => Slot)
    slot: Slot;

    @ForeignKey(() => Slot)
    @Column
    slotId: number;
}

export default Ability;