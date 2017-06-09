import { Table, Column, Model, BelongsToMany } from 'sequelize-typescript';

@Table
class Setup extends Model<Setup> {

    @Column
    name: string;

    @Column
    hasDaytalk: boolean;
}

export default Setup;