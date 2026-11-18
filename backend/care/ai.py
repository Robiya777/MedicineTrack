"""Conservative demo adapter. No external model receives patient information."""

from pypdf import PdfReader


def extract_mock(extraction):
    if extraction.attachment_id:
        with extraction.attachment.file.open("rb") as source:
            reader = PdfReader(source)
            if len(reader.pages) > 100:
                raise ValueError("PDF_PAGE_LIMIT")
            pages = [
                (index + 1, (page.extract_text() or "")[:100000])
                for index, page in enumerate(reader.pages)
            ]
    else:
        pages = [(1, extraction.source_text)]
    if not any(text.strip() for _, text in pages):
        raise ValueError("TEXT_NOT_FOUND")
    result = {
        "summary": None,
        "diagnosis_text": None,
        "recommendations": [],
        "follow_up_text": None,
        "evidence": [],
        "missing_fields": [],
        "warnings": ["Demo/mock: tashqi AI modeli ishlatilmagan."],
    }
    prefixes = {
        "tashxis:": "diagnosis_text",
        "tavsiya:": "recommendations",
        "kuzatuv:": "follow_up_text",
        "xulosa:": "summary",
    }
    for page, text in pages:
        for line in text.splitlines():
            clean = line.strip()
            for prefix, field in prefixes.items():
                if clean.lower().startswith(prefix):
                    value = clean[len(prefix) :].strip()
                    if value and (field == "recommendations" or result[field] is None):
                        if field == "recommendations":
                            result[field].append(value)
                        else:
                            result[field] = value
                        result["evidence"].append(
                            {"field": field, "page": page, "source_excerpt": clean}
                        )
    result["missing_fields"] = [
        key
        for key in ["summary", "diagnosis_text", "recommendations", "follow_up_text"]
        if not result[key]
    ]
    return result
