"""Deterministic keyword baseline. No embeddings or model-quality claim."""
import unicodedata
from typing import Protocol
from contracts import DOCUMENTS,evidence_of
class Retriever(Protocol):
    async def search(self,owner:str,question:str)->list[dict]:...
class KeywordRetriever:
    def __init__(self,documents=None):self.documents=DOCUMENTS if documents is None else documents
    async def search(self,owner,question):
        normalized=unicodedata.normalize('NFKC',question).lower()
        scored=[(sum(word in normalized for word in d['keywords']),d) for d in self.documents if d['owner'] in {'public',owner}]
        scored.sort(key=lambda item:(-item[0],item[1]['id']))
        return evidence_of([d for score,d in scored if score>0][:3])
