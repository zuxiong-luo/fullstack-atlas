"""Chapter 2: prompt versioning, response boundary and deterministic regression."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
KINDS = {'access', 'billing', 'unknown'}
SCHEMA = {'type': 'object', 'properties': {
    'kind': {'type': 'string', 'enum': sorted(KINDS)},
    'reason': {'type': 'string'}}, 'required': ['kind', 'reason'], 'additionalProperties': False}


def strict_json(text: str):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError('DUPLICATE_KEY')
            out[key] = value
        return out
    def reject_constant(value):
        raise ValueError('NON_JSON_NUMBER')
    return json.loads(text, object_pairs_hook=unique, parse_constant=reject_constant)


def validate_result(data):
    if type(data) is not dict or set(data) != {'kind', 'reason'}:
        raise ValueError('INVALID_RESULT_FIELDS')
    if type(data['kind']) is not str or data['kind'] not in KINDS:
        raise ValueError('INVALID_KIND')
    if type(data['reason']) is not str or not 1 <= len(data['reason'].strip()) <= 300:
        raise ValueError('INVALID_REASON')
    return data


def build_payload(ticket: str, model: str, version='v2'):
    if version not in {'v1', 'v2'}:
        raise ValueError('INVALID_PROMPT_VERSION')
    if not isinstance(ticket, str) or not 1 <= len(ticket.strip()) <= 2000:
        raise ValueError('INVALID_TICKET')
    prompt = (ROOT / 'prompts' / f'triage-{version}.txt').read_text()
    payload = {'model': model, 'store': False, 'instructions': prompt,
               'input': json.dumps({'ticket': ticket}, ensure_ascii=False),
               'max_output_tokens': 512, 'text': {'format': {
                   'type': 'json_schema', 'name': 'ticket_triage', 'strict': True, 'schema': SCHEMA}}}
    return payload, hashlib.sha256(prompt.encode()).hexdigest()


def parse_response(envelope):
    if not isinstance(envelope, dict):
        raise ValueError('INVALID_ENVELOPE')
    if envelope.get('status') != 'completed':
        raise ValueError('INCOMPLETE_RESPONSE')
    output = envelope.get('output')
    if type(output) is not list:
        raise ValueError('INVALID_ENVELOPE')
    text = []
    for item in output:
        if type(item) is not dict:
            raise ValueError('INVALID_ENVELOPE')
        if item.get('type') != 'message':
            continue
        content = item.get('content')
        if type(content) is not list:
            raise ValueError('INVALID_ENVELOPE')
        for part in content:
            if type(part) is not dict:
                raise ValueError('INVALID_ENVELOPE')
            if part.get('type') == 'refusal':
                raise ValueError('MODEL_REFUSAL')
            if part.get('type') == 'output_text':
                if type(part.get('text')) is not str:
                    raise ValueError('INVALID_ENVELOPE')
                text.append(part['text'])
    if len(text) != 1:
        raise ValueError('EXPECTED_ONE_OUTPUT')
    return validate_result(strict_json(text[0]))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def call_model(payload, api_key, endpoint='https://api.openai.com/v1/responses'):
    # Endpoint is fixed by the server/CLI, never copied from a user ticket.
    request = urllib.request.Request(endpoint, data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'})
    opener = urllib.request.build_opener(NoRedirect, urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=10) as response:
            body = response.read(1_048_577)
            if len(body) > 1_048_576:
                raise ValueError('UPSTREAM_TOO_LARGE')
    except urllib.error.HTTPError as error:
        # Deliberately no automatic retry: call/cost may already have occurred.
        status = error.code
        error.close()
        raise ValueError(f'UPSTREAM_HTTP_{status}') from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError('UPSTREAM_UNAVAILABLE') from None
    return parse_response(strict_json(body.decode('utf-8')))


def evaluate(cases, provider):
    rows = []
    for case in cases:
        try:
            actual = validate_result(provider(case))['kind']
            rows.append({'id': case['id'], 'expected': case['expected'],
                         'actual': actual, 'passed': actual == case['expected'], 'error': None})
        except (ValueError, TypeError, KeyError) as error:
            rows.append({'id': case['id'], 'passed': False, 'error': str(error)})
    return {'passed': sum(r['passed'] for r in rows), 'total': len(rows), 'rows': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true', help='explicitly enables one billable request')
    args = parser.parse_args()
    if args.live:
        model, key = os.environ['OPENAI_MODEL'], os.environ['OPENAI_API_KEY']
        payload, digest = build_payload('登录后没有查看权限', model)
        print(json.dumps({'prompt_sha256': digest, 'result': call_model(payload, key)}, ensure_ascii=False))
    else:
        cases = json.loads((ROOT / 'fixtures/prompt-cases.json').read_text())
        print(json.dumps({'mode': 'fixture-replay-not-model-quality', **evaluate(cases, lambda c: c['mock'])}, ensure_ascii=False, indent=2))
