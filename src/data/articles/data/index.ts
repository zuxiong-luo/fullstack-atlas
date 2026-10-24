import type { Article } from '../../articleTypes';
import indexes from './database-indexes';
import mvcc from './database-mvcc';
import locks from './database-locks-deadlocks';
export const dataExpansionArticles: Article[] = [indexes,mvcc,locks];
