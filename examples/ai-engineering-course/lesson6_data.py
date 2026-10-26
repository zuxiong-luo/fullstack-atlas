"""Chapter 6: compile a finite query plan; never execute model SQL."""
import json
import sqlite3
from dataclasses import dataclass
from contextlib import closing


@dataclass(frozen=True)
class Principal:
    tenant: str
    can_read_tickets: bool


def setup(db):
    db.executescript('''CREATE TABLE tickets(id TEXT PRIMARY KEY,tenant TEXT,status TEXT,subject TEXT);
      INSERT INTO tickets VALUES('a-1','acme','open','申请只读权限');
      INSERT INTO tickets VALUES('a-2','acme','closed','发票问题');
      INSERT INTO tickets VALUES('b-1','other','open','其他租户的工单');''')


def compile_plan(principal, plan):
    if not principal.can_read_tickets or not principal.tenant:
        raise PermissionError('TOOL_FORBIDDEN')
    if type(plan) is not dict or set(plan) != {'status', 'limit'}:
        raise ValueError('INVALID_PLAN_FIELDS')
    if type(plan['status']) is not str or plan['status'] not in {'open', 'closed'}:
        raise ValueError('INVALID_STATUS')
    if type(plan['limit']) is not int or not 1 <= plan['limit'] <= 20:
        raise ValueError('INVALID_LIMIT')
    # Identifiers and tenant predicate belong to trusted code, not the model output.
    return ('SELECT id,status,subject FROM tickets WHERE tenant=? AND status=? ORDER BY id LIMIT ?',
            (principal.tenant, plan['status'], plan['limit']))


def query(db, principal, plan):
    sql, params = compile_plan(principal, plan)
    db.execute('PRAGMA query_only=ON')
    remaining_callbacks = 500
    def budget():
        nonlocal remaining_callbacks
        remaining_callbacks -= 1
        return 1 if remaining_callbacks <= 0 else 0
    db.set_progress_handler(budget, 100)
    try:
        return [dict(zip(['id', 'status', 'subject'], row)) for row in db.execute(sql, params)]
    finally:
        db.set_progress_handler(None, 0)


if __name__ == '__main__':
    with closing(sqlite3.connect(':memory:')) as db:
        setup(db)
        print(json.dumps(query(db, Principal('acme', True), {'status': 'open', 'limit': 5}), ensure_ascii=False))
        for plan in [{'sql': 'DROP TABLE tickets'}, {'status': "open\' OR 1=1 --", 'limit': 5},
                     {'status': 'open', 'limit': True}, {'status': 'open', 'limit': 1000}]:
            try:
                query(db, Principal('acme', True), plan)
            except ValueError as error:
                print('拒绝：', error)
