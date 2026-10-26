import json
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from lesson1_context import Turn, build_context, text_tokens
from lesson2_prompt import ROOT, build_payload, call_model, evaluate, parse_response, strict_json, validate_result
from lesson3_ingestion import Knowledge, chunks
from lesson4_workflow import workflow, config, decide, apply_once
from lesson6_data import Principal, compile_plan, query, setup

class ContextTests(unittest.TestCase):
    def test_real_tokenizer(self):
        self.assertGreater(text_tokens('权限 permission'), 0)
        self.assertEqual(text_tokens('hello'), 1)
    def test_keeps_complete_newest_turn(self):
        turns = [Turn('旧问题' * 20, '旧回答' * 20), Turn('新问题', '新回答')]
        recent = build_context('规则', turns[1:], '当前问题', 10000)
        limited = build_context('规则', turns, '当前问题', recent['estimated_input_tokens'])
        self.assertEqual(limited['messages'], recent['messages'])
        self.assertEqual(limited['dropped_turns'], 1)
    def test_required_input_not_truncated(self):
        with self.assertRaisesRegex(ValueError, 'CONTEXT_TOO_LARGE'):
            build_context('规则', [], '权限' * 100, 20)
    def test_invalid_budgets(self):
        for budget in [0, -1, True]:
            with self.assertRaises(ValueError): build_context('规则', [], '问题', budget)
        with self.assertRaises(ValueError): build_context('规则', [], '问题', 100, -1)

class PromptTests(unittest.TestCase):
    def test_fixture_replay_exposes_semantic_failure(self):
        cases = json.loads((ROOT / 'fixtures/prompt-cases.json').read_text())
        report = evaluate(cases, lambda case: case['mock'])
        self.assertEqual((report['passed'], report['total']), (4, 5))
        self.assertFalse(report['rows'][-1]['passed']);self.assertIsNone(report['rows'][-1]['error'])
    def test_strict_json(self):
        for text in ['{"kind":"access","kind":"billing"}', '{"x":NaN}']:
            with self.assertRaises(ValueError): strict_json(text)
    def test_schema_and_business_contract(self):
        for result in [{}, {'kind':'access','reason':''}, {'kind':'admin','reason':'x'},
                       {'kind':'billing','reason':'x','execute':True}]:
            with self.assertRaises(ValueError): validate_result(result)
    def test_prompt_hash_and_input_separation(self):
        payload,digest = build_payload('用户专属输入-7f3','configured-model','v2')
        _,old_digest = build_payload('用户专属输入-7f3','configured-model','v1')
        self.assertNotEqual(digest,old_digest);self.assertEqual(json.loads(payload['input']),{'ticket':'用户专属输入-7f3'})
        self.assertNotIn('用户专属输入-7f3',payload['instructions']);self.assertFalse(payload['store'])
    def test_response_states(self):
        with self.assertRaisesRegex(ValueError,'INCOMPLETE'): parse_response({'status':'incomplete','output':[]})
        with self.assertRaisesRegex(ValueError,'REFUSAL'):
            parse_response({'status':'completed','output':[{'type':'message','content':[{'type':'refusal','refusal':'no'}]}]})
        with self.assertRaisesRegex(ValueError,'EXPECTED_ONE'): parse_response({'status':'completed','output':[]})
    def test_malformed_envelope_rejected(self):
        for output in [None, {}, ['not-an-item'], [{'type':'message','content':[{} , 12]}]]:
            with self.assertRaises(ValueError): parse_response({'status':'completed','output':output})
    def test_actual_http_adapter_without_paid_model(self):
        seen=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_POST(self):
                seen.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
                self.send_response(200);self.end_headers()
                self.wfile.write(json.dumps({'status':'completed','output':[{'type':'message','content':[
                    {'type':'output_text','text':json.dumps({'kind':'access','reason':'fixture'})}]}]}).encode())
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            payload,_=build_payload('没有权限','fixture-model')
            result=call_model(payload,'test-only',f'http://127.0.0.1:{server.server_port}/responses')
            self.assertEqual(result['kind'],'access');self.assertEqual(seen[0]['text']['format']['type'],'json_schema')
        finally: server.shutdown();server.server_close();thread.join()

class IngestionTests(unittest.TestCase):
    def setUp(self): self.knowledge=Knowledge()
    def tearDown(self): self.knowledge.close()
    def test_offsets_and_overlap(self):
        text='一二三四五六七八九十';parts=list(chunks(text,6,2))
        self.assertEqual(parts,[(0,6,'一二三四五六'),(4,10,'五六七八九十')])
        for start,end,part in parts: self.assertEqual(text[start:end],part)
        with self.assertRaises(ValueError): list(chunks(text,6,6))
    def test_tenant_filter_before_retrieval(self):
        for tenant in ['acme','other']: self.knowledge.ingest(tenant,'access','access.txt','账号权限需要审批')
        hits=self.knowledge.search('acme','账号权限')
        self.assertEqual({h['tenant'] for h in hits},{'acme'});self.assertEqual(self.knowledge.search('acme','火星天气'),[])
    def test_old_citation_invalidated_and_other_tenant_preserved(self):
        for tenant in ['acme','other']: self.knowledge.ingest(tenant,'access','access.txt','账号权限需要审批')
        old=self.knowledge.search('acme','账号权限')[0]
        self.knowledge.ingest('acme','access','access.txt','现在改为工单审批')
        with self.assertRaisesRegex(ValueError,'STALE_OR_FORBIDDEN'): self.knowledge.citation('acme',old['id'])
        self.assertEqual(len(self.knowledge.search('other','账号权限')),1)
    def test_chunk_policy_is_part_of_version(self):
        a=self.knowledge.ingest('acme','doc','a.txt','abcdefghijk',6,2)
        b=self.knowledge.ingest('acme','doc','a.txt','abcdefghijk',8,2)
        self.assertNotEqual(a['version'],b['version'])
    def test_source_change_creates_new_version(self):
        a=self.knowledge.ingest('acme','doc','old.txt','账号权限')
        b=self.knowledge.ingest('acme','doc','new.txt','账号权限')
        self.assertNotEqual(a['version'],b['version'])
    def test_insert_failure_rolls_back_document_and_chunk_replacement(self):
        original=self.knowledge.ingest('acme','doc','old.txt','账号权限需要审批')
        old_id=self.knowledge.search('acme','账号权限')[0]['id']
        self.knowledge.db.executescript("""CREATE TRIGGER fail_new BEFORE INSERT ON chunks
          WHEN NEW.text LIKE '%故障%' BEGIN SELECT RAISE(ABORT,'INJECTED'); END;""")
        with self.assertRaises(sqlite3.IntegrityError):
            self.knowledge.ingest('acme','doc','new.txt','故障中的新版本')
        self.assertEqual(self.knowledge.citation('acme',old_id)['version'],original['version'])
    def test_reingest_is_idempotent(self):
        one=self.knowledge.ingest('acme','doc','doc.txt','账号权限')
        two=self.knowledge.ingest('acme','doc','doc.txt','账号权限')
        self.assertEqual(one,two);self.assertEqual(self.knowledge.db.execute('SELECT COUNT(*) FROM chunks').fetchone()[0],1)

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory();self.path=self.directory.name+'/state.sqlite';self.identity=config('acme','t1')
    def tearDown(self): self.directory.cleanup()
    def begin(self,graph): return graph.invoke({'tenant':'acme','ticket':'t1','question':'申请权限'},self.identity)
    def test_pause_then_new_instance_resume(self):
        with workflow(self.path) as graph:
            first=self.begin(graph);digest=first['__interrupt__'][0].value['proposal_hash']
            self.assertEqual(first['status'],'waiting_approval')
        with workflow(self.path) as graph:
            self.assertEqual(decide(graph,self.identity,True,digest)['status'],'completed')
            with self.assertRaisesRegex(ValueError,'NOT_WAITING'): decide(graph,self.identity,True,digest)
        with closing(sqlite3.connect(self.path)) as db: self.assertEqual(db.execute('SELECT COUNT(*) FROM effects').fetchone()[0],1)
    def test_reject_has_no_effect(self):
        with workflow(self.path) as graph:
            first=self.begin(graph);final=decide(graph,self.identity,False,first['__interrupt__'][0].value['proposal_hash'])
            self.assertEqual(final['status'],'rejected')
        with closing(sqlite3.connect(self.path)) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='effects'").fetchone()[0],0)
    def test_changed_approval_rejected(self):
        with workflow(self.path) as graph:
            self.begin(graph)
            with self.assertRaisesRegex(ValueError,'INVALID_APPROVAL'): decide(graph,self.identity,True,'different-proposal')
    def test_crash_after_effect_does_not_duplicate(self):
        with workflow(self.path,fail_after_effect=True) as graph:
            first=self.begin(graph)
            with self.assertRaisesRegex(RuntimeError,'SIMULATED_CRASH'):
                decide(graph,self.identity,True,first['__interrupt__'][0].value['proposal_hash'])
        with workflow(self.path) as graph: self.assertEqual(graph.invoke(None,self.identity)['status'],'completed')
        with closing(sqlite3.connect(self.path)) as db: self.assertEqual(db.execute('SELECT COUNT(*) FROM effects').fetchone()[0],1)
    def test_conflicting_idempotency_payload(self):
        proposal={'tenant':'acme','ticket':'t1','action':'create_access_ticket','question':'one'};apply_once(self.path,proposal)
        with self.assertRaisesRegex(ValueError,'IDEMPOTENCY_CONFLICT'): apply_once(self.path,{**proposal,'question':'two'})
    def test_tenant_namespace_does_not_resume_other_tenant(self):
        with workflow(self.path) as graph:
            self.begin(graph)
            with self.assertRaisesRegex(ValueError,'NOT_WAITING'): decide(graph,config('other','t1'),True,'unknown')

class DataTests(unittest.TestCase):
    def setUp(self): self.db=sqlite3.connect(':memory:');setup(self.db)
    def tearDown(self): self.db.close()
    def test_only_current_tenant(self):
        rows=query(self.db,Principal('acme',True),{'status':'open','limit':5})
        self.assertEqual([r['id'] for r in rows],['a-1'])
    def test_no_permission(self):
        with self.assertRaises(PermissionError): query(self.db,Principal('acme',False),{'status':'open','limit':5})
    def test_bad_plan_rejected(self):
        for plan in [{'sql':'SELECT * FROM tickets'}, {'status':"open' OR 1=1 --",'limit':5},
                     {'status':'open','limit':True},{'status':'open','limit':21},{'status':'open','limit':5,'tenant':'other'}]:
            with self.subTest(plan=plan),self.assertRaises(ValueError): query(self.db,Principal('acme',True),plan)
    def test_parameterized_values(self):
        sql,values=compile_plan(Principal('acme',True),{'status':'open','limit':5})
        self.assertNotIn('acme',sql);self.assertEqual(values,('acme','open',5))
    def test_vm_budget_aborts_and_cleans_handler(self):
        self.db.executemany('INSERT INTO tickets VALUES(?,?,?,?)', [(f'z{i}', 'other', 'closed', 'load') for i in range(20000)])
        with self.assertRaisesRegex(sqlite3.OperationalError, 'interrupted'):
            query(self.db, Principal('no-matches', True), {'status':'open','limit':5})
        self.assertEqual(self.db.execute('SELECT 1').fetchone()[0], 1)
    def test_database_read_only(self):
        query(self.db,Principal('acme',True),{'status':'open','limit':5})
        with self.assertRaises(sqlite3.OperationalError): self.db.execute('DELETE FROM tickets')

if __name__=='__main__': unittest.main()
