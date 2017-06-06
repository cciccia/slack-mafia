import { Table, Column, Model, HasMany } from 'sequelize-typescript';
import Role from './role';

@Table
export default class Alignment extends Model<Alignment> {
    @Column
    name: string;

    @Column
    color: string;
}