import { Table, Column, Model, PrimaryKey } from 'sequelize-typescript';

@Table
class AbilityType extends Model<AbilityType> {
    @PrimaryKey
    @Column
    id: number;
}

export default AbilityType;