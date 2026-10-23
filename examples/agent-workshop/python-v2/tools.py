"""Documents are data; only this server-owned allowlist grants tool execution."""
from contracts import DOCUMENTS,exact,identifier,fail,evidence_of,trim

def lookup(owner,document_id,documents=None):
    for doc in DOCUMENTS if documents is None else documents:
        if doc['id']==document_id and doc['owner'] in {'public',owner}:return evidence_of([doc])[0]
    fail(403,'DOCUMENT_FORBIDDEN')
def execute_tool(owner,raw,documents=None):
    body=exact(raw,['name','arguments'])
    if not isinstance(body['name'],str):fail(400,'INVALID_REQUEST')
    if trim(body['name'])!='lookup_document':fail(403,'TOOL_FORBIDDEN')
    args=exact(body['arguments'],['document_id'])
    return lookup(owner,identifier(args['document_id']),documents)
