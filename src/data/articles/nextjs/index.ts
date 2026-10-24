import type { Article } from '../../articleTypes';
import routing from './next-routing';
import cache from './next-data-cache';
import writes from './next-server-writes';
export const nextExpansionArticles: Article[] = [routing, cache, writes];
