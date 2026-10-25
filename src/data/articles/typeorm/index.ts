import type {Article} from '../../articleTypes';
import foundations from './typeorm-foundations';
import relations from './typeorm-relations-queries';
import transactions from './typeorm-transactions-concurrency';
import migrations from './typeorm-migrations-performance';
export const typeormExpansionArticles:Article[] = [foundations,relations,transactions,migrations];
