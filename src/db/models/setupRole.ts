import { Table, Column, Model, ForeignKey } from 'sequelize-typescript';
import Alignment from './alignment';
import Role from './role';
import Setup from './setup';

@Table
class SetupRole extends Model<SetupRole> {

    @ForeignKey(() => Setup)
    @Column
    setupId: number;

    @ForeignKey(() => Role)
    roleId: number;
}

export default SetupRole;