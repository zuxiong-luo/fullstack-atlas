import 'server-only';
import {unstable_cache} from 'next/cache';
import {readCatalog} from './store';
export const getCatalog=unstable_cache(readCatalog,['atlas-public-catalog-v1',process.env.DEMO_DATA_FILE||'default-local-data'],{
 tags:['atlas-public-catalog'],revalidate:60,
});
