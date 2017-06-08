import { Table, Column, Model, PrimaryKey } from 'sequelize-typescript';

@Table
class Parity extends Model<Parity> {
    @PrimaryKey
    @Column
    id: number;
}

export default Parity;