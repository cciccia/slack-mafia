import { Table, Column, Model, HasMany } from 'sequelize-typescript';
import Slot from './slot';

@Table
export default class Alignment extends Model<Alignment> {
    @Column
    name: string;

    @Column
    color: string;
}