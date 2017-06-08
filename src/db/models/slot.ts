import { Table, Column, Model, BelongsTo, BelongsToMany, ForeignKey } from 'sequelize-typescript';
import Alignment from './alignment';
import Setup from './setup';

@Table
class Slot extends Model<Slot> {

    @Column
    name: string;

    @BelongsTo(() => Alignment)
    alignment: Alignment;

    @ForeignKey(() => Alignment)
    @Column
    alignmentId: number;

    @BelongsTo(() => Setup)
    setup: Setup;

    @ForeignKey(() => Setup)
    @Column
    setupId: number;
}

export default Slot;