"""Chapter 1: count text tokens and preserve complete conversation turns."""
from dataclasses import dataclass
import json
import tiktoken

ENCODING = tiktoken.get_encoding('cl100k_base')


def text_tokens(text: str) -> int:
    return len(ENCODING.encode(text, disallowed_special=()))


@dataclass(frozen=True)
class Turn:
    question: str
    answer: str


def build_context(instruction: str, turns: list[Turn], question: str,
                  input_budget: int, overhead_per_message: int = 12) -> dict:
    """Local admission policy. Overhead is a teaching reserve, not API billing."""
    if type(input_budget) is not int or input_budget < 1:
        raise ValueError('INVALID_BUDGET')
    if type(overhead_per_message) is not int or overhead_per_message < 0:
        raise ValueError('INVALID_OVERHEAD')
    if not instruction.strip() or not question.strip():
        raise ValueError('EMPTY_INPUT')
    if len(instruction) + len(question) + sum(len(t.question) + len(t.answer) for t in turns) > 200_000:
        raise ValueError('INPUT_TOO_LARGE')
    def message(role, content):
        return {'role': role, 'content': content}
    base = [message('developer', instruction), message('user', question)]
    def cost(messages):
        return sum(text_tokens(m['content']) + overhead_per_message for m in messages)
    if cost(base) > input_budget:
        raise ValueError('CONTEXT_TOO_LARGE')
    chosen = []
    # Keep the newest contiguous suffix: never retain an answer without its question.
    for turn in reversed(turns):
        pair = [message('user', turn.question), message('assistant', turn.answer)]
        candidate = [base[0], *pair, *chosen, base[1]]
        if cost(candidate) > input_budget:
            break
        chosen = pair + chosen
    result = [base[0], *chosen, base[1]]
    return {'messages': result, 'estimated_input_tokens': cost(result),
            'dropped_turns': len(turns) - len(chosen) // 2,
            'encoding': ENCODING.name}


if __name__ == '__main__':
    print(json.dumps(build_context('只根据给定资料回答。', [Turn('如何重置？', '先验证身份。')],
                                   '权限不足怎么办？', 160), ensure_ascii=False, indent=2))
    try:
        build_context('规则', [], '长问题' * 100, 30)
    except ValueError as error:
        print('拒绝：', error)
