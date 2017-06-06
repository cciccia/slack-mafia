import { Table, Column, Model, BelongsTo, BelongsToMany, ForeignKey } from 'sequelize-typescript';
import Alignment from './alignment';
import SetupRole from './setupRole';
import Setup from './setup';

@Table
class Role extends Model<Role> {

    @Column
    name: string;

    @BelongsTo(() => Alignment)
    alignment: Alignment;

    @ForeignKey(() => Alignment)
    @Column
    alignmentId: number;

    @BelongsToMany(() => Setup, () => SetupRole)
    setups: Setup[];
}

export default Role;