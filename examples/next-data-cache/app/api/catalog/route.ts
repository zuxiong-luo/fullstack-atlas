import {getCatalog} from '../../../lib/cache';
import {handle} from '../../../lib/http';
export async function GET(){return handle(getCatalog);}
