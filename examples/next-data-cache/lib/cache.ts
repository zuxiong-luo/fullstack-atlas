import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { readCatalog,dataFile } from './store';
export const getCatalog=unstable_cache(readCatalog,['atlas-cache-chapter-v1',dataFile],{tags:['chapter-catalog'],revalidate:3600});
export const getRequestCatalog=cache(readCatalog);
