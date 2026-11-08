#!/usr/bin/env python3
"""Extract every MCQ from content/*.md into assets/data/questions.json.

Run from the repository root:  python tools/extract_questions.py
"""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "assets" / "data" / "questions.json"

BANGLA = "\u0995\u0996\u0997\u0998\u0999"  # ka, kha, ga, gha, nga
BANKS = [
    ("math", "Mathematics", "Math-Question-Bank.md", "abcdefgh"),
    ("english", "English", "English-Question-Bank.md", "abcdefgh"),
    ("bangla", "Bangla", "Bangla-Question-Bank.md", BANGLA),
    ("gk", "General Knowledge", "GK-Question-Bank.md", "abcdefgh"),
    ("ict", "ICT", "ICT-Question-Bank.md", "abcdefgh"),
    ("analytical", "Analytical", "Analytical-Question-Bank.md", "abcdefgh"),
]

MOCKS = [
    ("mock1", "Mock Test 1", "Mock-Test-1.md", "Mock-Test-1-Answer-Key.md", 90),
    ("mock2", "Mock Test 2", "Mock-Test-2.md", "Mock-Test-2-Answer-Key.md", 45),
]

Q_RE = re.compile(r"^\*\*(?:Q)?(\d+)\.\*\*\s*(.*)$")
SEC_RE = re.compile(r"^##\s+(.*)$")
ANS_RE = re.compile(r"^\*\*(Answer|\u0989\u09a4\u09cd\u09a4\u09b0)\s*:")


def clean(text):
    text = text.replace("**", "").replace("`", "")
    text = re.sub(r"\*\(([^)]*)\)\*", r"(\1)", text)
    text = re.sub(r"(?<!\w)\*|\*(?!\w)", "", text)
    text = text.replace(">", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_options(blob, letters):
    blob = re.sub(r"\s+", " ", blob).strip()
    found = []
    pos = 0
    for letter in letters:
        m = re.search(r"(?<![\w\u0980-\u09FF])" + re.escape(letter) + r"\)\s", blob[pos:])
        if not m:
            break
        start = pos + m.start()
        content_start = pos + m.end()
        found.append((letter, start, content_start))
        pos = content_start
    if len(found) < 2:
        return None
    opts = {}
    for i, (letter, _start, content_start) in enumerate(found):
        end = found[i + 1][1] if i + 1 < len(found) else len(blob)
        val = blob[content_start:end].strip(" .;")
        opts[letter] = clean(val)
    return opts


def parse_answer(line, letters):
    m = re.search(r"(?:Answer|\u0989\u09a4\u09cd\u09a4\u09b0)\s*:\s*([^\s)]+)\)", line)
    if not m:
        return None
    letter = m.group(1).strip()
    if letter not in letters:
        return None
    after = line.split("**", 2)
    tail = after[2] if len(after) >= 3 else ""
    return letter, clean(tail.lstrip(" \u2014-\u2013:"))


def parse_blocks(path, letters):
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    starts = []
    for i, line in enumerate(lines):
        m = Q_RE.match(line.strip())
        if m:
            starts.append((i, int(m.group(1)), m.group(2)))

    questions = []
    for idx, (line_no, number, first) in enumerate(starts):
        end = starts[idx + 1][0] if idx + 1 < len(starts) else len(lines)
        block = lines[line_no:end]
        block[0] = first

        topic = None
        for back in range(line_no, -1, -1):
            sm = SEC_RE.match(lines[back].strip())
            if sm:
                raw = clean(re.sub(r"^[A-Za-z\u0980-\u09FF]\.\s*", "", sm.group(1)))
                raw = re.sub(r"^Section\s+[A-Z]\s*[-\u2013\u2014]\s*", "", raw)
                topic = re.sub(r"\s*\(Q[^)]*\)\s*$", "", raw)
                break

        answer = None
        answer_idx = None
        for j, ln in enumerate(block):
            if ANS_RE.match(ln.strip()):
                answer = parse_answer(ln, letters)
                answer_idx = j
                break

        body_end = answer_idx if answer_idx is not None else len(block)
        q_lines = block[:body_end]

        first_opt = None
        for j, ln in enumerate(q_lines):
            if re.search(r"(?<![\w\u0980-\u09FF])" + re.escape(letters[0]) + r"\)\s", ln):
                first_opt = j
                break
        if first_opt is None:
            continue

        q_text = clean(" ".join(q_lines[:first_opt]))
        opts = split_options(" ".join(q_lines[first_opt:]), letters)
        if not opts or not q_text:
            continue

        exp = ""
        if answer:
            exp = answer[1]
            extra = []
            for ln in block[answer_idx + 1:]:
                s = ln.strip()
                if s.startswith("##") or s.startswith("---"):
                    break
                if s:
                    extra.append(s)
            if extra:
                exp = (exp + " " + " ".join(extra)).strip()

        questions.append({
            "n": number,
            "q": q_text,
            "opts": opts,
            "ans": answer[0] if answer else None,
            "exp": exp,
            "topic": topic or "General",
        })
    return questions


def parse_grid(key_text, letters):
    answers = {}
    for line in key_text.split("\n"):
        s = line.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if len(cells) < 2:
            continue
        for i in range(0, len(cells) - 1, 2):
            num, val = cells[i], cells[i + 1]
            val = val.replace("\\", "").replace("*", "").strip()
            if num.isdigit() and len(val) == 1 and val in letters:
                answers[int(num)] = val
    return answers


def parse_key_notes(key_text, letters):
    notes = {}
    pattern = re.compile(r"\*\*Q(\d+)\s*\(([^)]+)\)\*{0,2}")
    matches = list(pattern.finditer(key_text))
    for i, m in enumerate(matches):
        num = int(m.group(1))
        end = matches[i + 1].start() if i + 1 < len(matches) else len(key_text)
        chunk = key_text[m.end():end]
        chunk = chunk.split("\n### ")[0].split("\n## ")[0].split("\n---")[0]
        notes[num] = clean(chunk.lstrip(" \u2014-\u2013:*"))
    return notes


def parse_mock(paper_file, key_file, letters):
    questions = parse_blocks(CONTENT / paper_file, letters)
    key_text = (CONTENT / key_file).read_text(encoding="utf-8")
    grid = parse_grid(key_text, letters)
    notes = parse_key_notes(key_text, letters)
    for q in questions:
        q["ans"] = grid.get(q["n"])
        q["exp"] = notes.get(q["n"], "")
    return questions


def main():
    data = {"banks": [], "mocks": []}
    problems = []

    for bank_id, name, fname, letters in BANKS:
        qs = parse_blocks(CONTENT / fname, letters)
        missing = [q["n"] for q in qs if not q["ans"]]
        if missing:
            problems.append((bank_id, "no answer", missing))
        for q in qs:
            q["id"] = "%s:%d" % (bank_id, q["n"])
        data["banks"].append({"id": bank_id, "name": name, "questions": qs})
        print("%-11s %3d questions" % (bank_id, len(qs)))

    for mock_id, name, paper, key, minutes in MOCKS:
        qs = parse_mock(paper, key, "abcdefgh")
        missing = [q["n"] for q in qs if not q["ans"]]
        if missing:
            problems.append((mock_id, "no answer", missing))
        for q in qs:
            q["id"] = "%s:%d" % (mock_id, q["n"])
        data["mocks"].append({
            "id": mock_id,
            "name": name,
            "minutes": minutes,
            "questions": qs,
        })
        print("%-11s %3d questions" % (mock_id, len(qs)))

    total = sum(len(b["questions"]) for b in data["banks"]) + sum(len(m["questions"]) for m in data["mocks"])
    print("TOTAL       %3d questions" % total)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote %s (%.0f KB)" % (OUT, OUT.stat().st_size / 1024))

    for p in problems:
        print("PROBLEM", p, file=sys.stderr)
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
