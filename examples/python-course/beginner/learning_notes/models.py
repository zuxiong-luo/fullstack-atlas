class Note:
    def __init__(self, title):
        self.title = title
        self.done = False

    def finish(self):
        self.done = True

    def describe(self):
        if self.done:
            return self.title + "：已完成"
        return self.title + "：未完成"

    def to_dict(self):
        return {"title": self.title, "done": self.done}


class TaggedNote(Note):
    def __init__(self, title, tag):
        super().__init__(title)
        self.tag = tag

    def describe(self):
        return super().describe() + " [" + self.tag + "]"


class Notebook:
    def __init__(self):
        self.notes = []

    def add(self, note):
        self.notes.append(note)

    def titles(self):
        result = []
        for note in self.notes:
            result.append(note.title)
        return result

    def to_list(self):
        result = []
        for note in self.notes:
            result.append(note.to_dict())
        return result

    def __len__(self):
        return len(self.notes)

    def __iter__(self):
        return iter(self.notes)


if __name__ == "__main__":
    first = Note("学习类")
    second = Note("复习函数")
    first.finish()
    print(first.describe())
    print(second.describe())
    book = Notebook()
    book.add(first)
    book.add(second)
    print(book.titles())
    print(len(book))
    for note in book:
        print(note.title)
    another = Notebook()
    print(len(another))
