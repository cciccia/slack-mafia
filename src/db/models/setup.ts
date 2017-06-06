import { Table, Column, Model, BelongsToMany } from 'sequelize-typescript';
import SetupRole from './setupRole';
import Role from './role';

@Table
class Setup extends Model<Setup> {

    @Column
    name: string;

    @BelongsToMany(() => Role, () => SetupRole)
    roles: Role[];
}

export default Setup;