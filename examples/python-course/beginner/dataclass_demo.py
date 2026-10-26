from dataclasses import dataclass, field


@dataclass
class SimpleNote:
    title: str
    done: bool = False
    labels: list[str] = field(default_factory=list)


if __name__ == "__main__":
    first = SimpleNote("学习类")
    second = SimpleNote("学习类")
    print(first)
    print(first == second)
    print(first is second)
    first.labels.append("python")
    print(second.labels)
