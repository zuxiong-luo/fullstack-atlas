import json
from pathlib import Path

root = Path(__file__).resolve().parent
article = root.parents[1] / "src/data/articles/operations" / (root.name + ".ts")
if not article.exists():
    print("Standalone download: article source absent; source mapping not checked.")
else:
    source_text = article.read_text()
    data = json.JSONDecoder().raw_decode(source_text.split("const article: Article = ", 1)[1])[0]
    count = 0
    prefix = "examples/" + root.name + "/"
    for section in data["sections"]:
        for block in section.get("blocks", []):
            if block["type"] == "code" and block.get("filename", "").startswith(prefix):
                source = (root / block["filename"][len(prefix):]).read_text()
                assert block["code"] in source, block["filename"]
                count += 1
    assert count > 0
    print(f"{root.name}: {count} contiguous source blocks match")
