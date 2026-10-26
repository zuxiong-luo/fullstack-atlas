"""Chapter 4: real LangGraph interrupts and durable idempotent local effects."""
import hashlib
import json
import sqlite3
import tempfile
from contextlib import contextmanager, closing
from typing import TypedDict
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt


class State(TypedDict):
    tenant: str
    ticket: str
    question: str
    proposal: dict
    receipt: str
    status: str


def proposal_digest(proposal):
    return hashlib.sha256(json.dumps(proposal, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def apply_once(path, proposal):
    digest = proposal_digest(proposal)
    operation = f"{proposal['tenant']}:{proposal['ticket']}"
    with closing(sqlite3.connect(path)) as db, db:
        db.execute('''CREATE TABLE IF NOT EXISTS effects(
          operation TEXT PRIMARY KEY, digest TEXT NOT NULL, receipt TEXT NOT NULL)''')
        receipt = 'receipt-' + digest[:16]
        db.execute('INSERT INTO effects VALUES(?,?,?) ON CONFLICT(operation) DO NOTHING',
                   (operation, digest, receipt))
        old = db.execute('SELECT digest,receipt FROM effects WHERE operation=?', (operation,)).fetchone()
        if old[0] != digest:
            raise ValueError('IDEMPOTENCY_CONFLICT')
        return old[1]


@contextmanager
def workflow(path, fail_after_effect=False):
    def prepare(state):
        return {'proposal': {'tenant': state['tenant'], 'ticket': state['ticket'],
                             'action': 'create_access_ticket', 'question': state['question']},
                'status': 'waiting_approval'}

    def approval(state):
        proposal = state['proposal']
        digest = proposal_digest(proposal)
        decision = interrupt({'proposal': proposal, 'proposal_hash': digest})
        if (type(decision) is not dict or set(decision) != {'approved', 'proposal_hash'}
                or type(decision['approved']) is not bool or decision['proposal_hash'] != digest):
            raise ValueError('INVALID_APPROVAL')
        return {'status': 'approved' if decision['approved'] else 'rejected'}

    def execute(state):
        receipt = apply_once(path, state['proposal'])
        if fail_after_effect:
            raise RuntimeError('SIMULATED_CRASH_AFTER_EFFECT')
        return {'receipt': receipt, 'status': 'completed'}

    builder = StateGraph(State)
    builder.add_node('prepare', prepare)
    builder.add_node('approval', approval)
    builder.add_node('execute', execute)
    builder.add_edge(START, 'prepare')
    builder.add_edge('prepare', 'approval')
    builder.add_conditional_edges('approval', lambda s: 'execute' if s['status'] == 'approved' else END)
    builder.add_edge('execute', END)
    with SqliteSaver.from_conn_string(str(path)) as saver:
        yield builder.compile(checkpointer=saver)


def config(tenant, ticket):
    # CLI trusted identity: a network service must derive tenant from authenticated identity.
    for value in [tenant, ticket]:
        if not isinstance(value, str) or not value or ':' in value or len(value) > 40:
            raise ValueError('INVALID_IDENTITY')
    return {'configurable': {'thread_id': f'{tenant}:{ticket}'}, 'recursion_limit': 10}


def decide(graph, identity, approved, proposal_hash):
    state = graph.get_state(identity)
    if not state.values or not state.tasks or not any(t.interrupts for t in state.tasks):
        raise ValueError('NOT_WAITING_APPROVAL')
    expected_thread = f"{state.values['tenant']}:{state.values['ticket']}"
    if identity['configurable']['thread_id'] != expected_thread:
        raise ValueError('IDENTITY_MISMATCH')
    return graph.invoke(Command(resume={'approved': approved, 'proposal_hash': proposal_hash}), identity)


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as directory:
        path = directory + '/workflow.sqlite'
        identity = config('acme', 'ticket-1')
        with workflow(path) as graph:
            first = graph.invoke({'tenant': 'acme', 'ticket': 'ticket-1', 'question': '申请只读权限'}, identity)
            digest = first['__interrupt__'][0].value['proposal_hash']
            print('暂停：', first['status'])
        # New saver/graph instance loads the same SQLite checkpoint.
        with workflow(path) as graph:
            final = decide(graph, identity, True, digest)
            print('恢复：', final['status'], final['receipt'])
        with closing(sqlite3.connect(path)) as db, db:
            print('副作用条数：', db.execute('SELECT COUNT(*) FROM effects').fetchone()[0])
