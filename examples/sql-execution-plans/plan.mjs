export async function explain(db,query,params=[]){return (await db.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+query,params)).rows[0]['QUERY PLAN'][0];}
export function nodes(plan){const root=plan.Plan??plan;return [root,...(root.Plans??[]).flatMap(nodes)];}
export function summary(plan){return nodes(plan).map(node=>({type:node['Node Type'],estimated:node['Plan Rows'],actual:node['Actual Rows'],loops:node['Actual Loops'],removed:node['Rows Removed by Filter']??0,index:node['Index Name'],sort:node['Sort Method'],space:node['Sort Space Type']}));}
