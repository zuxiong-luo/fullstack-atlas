def add_minutes(current, extra):
    total = current + extra
    return total


def clean_title(title):
    return title.strip()


def make_note(title, done=False):
    return {"title": clean_title(title), "done": done}


def unfinished_titles(notes):
    result = []
    for note in notes:
        if not note["done"]:
            result.append(note["title"])
    return result


def add_label(label, labels=None):
    if labels is None:
        labels = []
    labels.append(label)
    return labels


def show_title(title):
    print(title)


def bad_labels(label, labels=[]):
    labels.append(label)
    return labels


def format_title(title, transform):
    return transform(title)


def make_prefix(prefix):
    def attach(title):
        return prefix + title
    return attach


def count_to(limit):
    number = 1
    while number <= limit:
        yield number
        number = number + 1


if __name__ == "__main__":
    print(add_minutes(20, 10))
    notes = [make_note("  学习函数  "), make_note("复习变量", done=True)]
    print(unfinished_titles(notes))
    print(add_label("python"))
    print(add_label("web"))
    print(format_title("  标题  ", clean_title))
    decorate = make_prefix("笔记：")
    print(decorate("函数"))
    numbers = count_to(3)
    print(next(numbers))
    print(list(numbers))
