import {EntitySchema} from 'typeorm';
import {source,NoteEntity,OwnerEntity,type Note} from './model.js';
const ds=source(process.env.LAB_SCHEMA??'typeorm_migrations');
if(process.env.ADD_REVIEW_COLUMN==='1'){
 const extended=new EntitySchema<Note & {reviewedAt:Date|null}>({...NoteEntity.options,columns:{...NoteEntity.options.columns,reviewedAt:{type:'timestamptz',nullable:true}}});
 ds.setOptions({entities:[OwnerEntity,extended]});
}
ds.setOptions({migrations:process.env.LAB_MIGRATIONS?[process.env.LAB_MIGRATIONS]:[],migrationsTableName:'migration_history'});
export default ds;
