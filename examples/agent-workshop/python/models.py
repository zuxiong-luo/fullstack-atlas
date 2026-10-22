"""Chapter 01 boundaries: types are strict; citations are only checked for membership."""
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, BeforeValidator, model_validator

# Match ECMAScript String.trim exactly so both implementations normalize identically.
TRIM_CHARS = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
def trim_text(value):
    return value.strip(TRIM_CHARS) if isinstance(value, str) else value

Identifier = Annotated[str, StringConstraints(pattern=r'^[A-Za-z0-9_-]{1,64}$')]
Question = Annotated[str, StringConstraints(min_length=1, max_length=2000), BeforeValidator(trim_text)]
DocumentText = Annotated[str, StringConstraints(min_length=1, max_length=10000), BeforeValidator(trim_text)]
AnswerText = Annotated[str, StringConstraints(min_length=1, max_length=4000), BeforeValidator(trim_text)]

class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid')

class Document(StrictModel):
    id: Identifier
    text: DocumentText

class AnswerRequest(StrictModel):
    question: Question
    documents: list[Document] = Field(min_length=1, max_length=20)

    @model_validator(mode='after')
    def unique_documents(self):
        if len({doc.id for doc in self.documents}) != len(self.documents):
            raise ValueError('Document IDs must be unique')
        return self

class ModelAnswer(StrictModel):
    answer: AnswerText
    citations: list[Identifier] = Field(min_length=1)

    @model_validator(mode='after')
    def unique_citations(self):
        if len(set(self.citations)) != len(self.citations):
            raise ValueError('Citation IDs must be unique')
        return self
