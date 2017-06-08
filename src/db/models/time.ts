import { Table, Column, Model, PrimaryKey } from 'sequelize-typescript';

@Table
class Time extends Model<Time> {
    @PrimaryKey
    @Column
    id: number;
}

export default Time;