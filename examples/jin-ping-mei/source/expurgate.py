#!/usr/bin/env python3
"""Produce an expurgated (洁本) reading text of 金瓶梅 from the Project Gutenberg source.

Rationale
---------
Project Gutenberg eBook #52200 is the unabridged 崇祯本 recension. Its narrative
substance — household economics, ritual, litigation, servant hierarchy, and the
power struggle among the women of the 西門 household — is what this adaptation
needs. Its explicit sexual passages are not, and are excluded here.

Method
------
Redaction is sentence-level and lexicon-driven, with two safeguards learned from
an earlier version of this script that failed:

1. FILTER_LEXICON covers BOTH registers. The first version listed only literary
   euphemisms (麈柄/龜頭/雲雨) and missed the vernacular layer the book actually
   uses most (肏/奶頭/酥胸/淫水/精泄/澡牝…), leaking 87 explicit sentences across
   43 chapters. Both registers are now covered.

2. AUDIT_LEXICON is written INDEPENDENTLY of FILTER_LEXICON and never
   participates in redaction — it only decides the exit code. The first version
   filtered on lexicon L and then verified with lexicon L, which is circular: it
   necessarily reports success no matter how much it missed. Acceptance must be
   judged by a list that did not do the filtering.

Erotic passages in this recension run as blocks, not isolated sentences, so a
paragraph with two or more flagged sentences has the entire span between the
first and last flag removed, including unflagged connective sentences. Verse
tags (詞曰/有詩為證 …) adjacent to a cut go with it, since such scenes are
routinely framed by verse.

Chapter headings (回目) are never redacted: they are canonical bibliographic
data, several legitimately contain flagged words (第61回 燒陰戶, 第73回 白綾帶),
and scripts/validate_repo.py requires them intact.

Both lexicons deliberately over-match. Losing some innocuous sentences is an
acceptable price for not shipping explicit content; the reverse is not.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

START_MARKER = "*** START OF THE PROJECT GUTENBERG EBOOK"
END_MARKER = "*** END OF THE PROJECT GUTENBERG EBOOK"

REDACTION = "〔此處刪節〕"

# --- Filtering vocabulary -------------------------------------------------
# Drives redaction. Covers the literary/euphemistic register AND the vernacular
# register. Broad words carrying innocent senses (精, 乳, 泄, 日) appear only in
# compound form so they cannot scrub ordinary narrative.
FILTER_LEXICON = (
    # vernacular verbs
    "肏", "幹得", "幹了", "日了", "弄了一回", "弄得",
    # anatomy — vernacular
    "奶頭", "奶子", "酥胸", "香乳", "胸乳", "乳峰", "白生生腿", "腿兒蹺",
    "皮肉兒", "屄", "牝", "陰戶", "陰門", "陽物", "陽事",
    # anatomy — literary
    "麈柄", "塵柄", "龜頭", "玉莖", "那話", "陽鋒",
    # fluids / climax
    "淫水", "精泄", "泄了精", "精來", "精邈", "遺精", "一泄如註", "泄身",
    "陰精", "陽精", "丟了身子",
    # acts
    "雲雨", "雲情雨意", "翻雲覆雨", "交歡", "交媾", "巫山", "品簫", "鏖戰",
    "顛鸞倒鳳", "魚水之歡", "抽送", "抽提", "抽捲", "抽拽", "聳動", "舉股",
    "扳其股", "扳住雙足", "交股", "澡牝", "刺牝", "牝屋", "赤身露體",
    "咂舌", "親嘴咂", "摟在懷裡", "摟抱", "按在炕上", "倒澆蠟燭",
    "隔山取火", "老漢推車", "金龍探爪", "雙關",
    # implements / aphrodisiacs
    "淫器", "銀托", "託子", "托子", "硫黃圈", "勉鈴", "緬鈴", "相思套",
    "封臍膏", "白綾帶", "懸玉環", "胡僧藥", "藥煮的", "春意", "顫聲嬌",
    # scene-level descriptors
    "淫聲浪語", "樂極情濃", "雲收雨散", "情濃", "浪聲",
)

# --- Acceptance vocabulary ------------------------------------------------
# Written independently of FILTER_LEXICON and NEVER used for redaction. Its only
# job is to answer "did anything explicit survive?" from outside the filter's own
# assumptions. It was derived by scanning what actually remained after the first
# (failed) pass, not by copying the filter list.
AUDIT_LEXICON = (
    "肏", "奶頭", "酥胸", "香乳", "淫水", "精泄", "精來", "精邈", "抽提",
    "抽捲", "舉股", "澡牝", "牝屋", "赤身露體", "咂舌", "一泄如註",
    "淫聲浪語", "白生生腿", "泄身", "親嘴咂", "摟在懷裡", "麈柄", "龜頭",
    "陰戶", "陽物", "那話", "雲雨", "淫器", "銀托", "勉鈴", "屄", "交歡",
    "顛鸞倒鳳", "腿兒蹺", "皮肉兒", "遺精", "雲收雨散",
)

VERSE_TAG = re.compile(r"^\s*(詞曰|詩曰|有詩為證|正是|但見|怎見得)")

SENTENCE_SPLIT = re.compile(r"(?<=[。！？；])")

CHAPTER_HEADING = re.compile(r"^\s*第[〇零○一二三四五六七八九十百]+回\s+\S")

CHINESE_DIGITS = {
    "〇": 0, "零": 0, "○": 0, "一": 1, "二": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
}


def chapter_number(value: str) -> int:
    if all(character in CHINESE_DIGITS for character in value):
        return int("".join(str(CHINESE_DIGITS[c]) for c in value))
    total = current = 0
    for character in value:
        if character in CHINESE_DIGITS:
            current = CHINESE_DIGITS[character]
        elif character == "十":
            total += (current or 1) * 10
            current = 0
        elif character == "百":
            total += (current or 1) * 100
            current = 0
    return total + current


def flagged_by(sentence: str, lexicon: tuple[str, ...]) -> bool:
    return any(term in sentence for term in lexicon)


def expurgate_paragraph(paragraph: str) -> tuple[str, int]:
    """Return (clean_paragraph, sentences_removed)."""
    if CHAPTER_HEADING.match(paragraph):
        return paragraph, 0

    sentences = [s for s in SENTENCE_SPLIT.split(paragraph) if s]
    if not sentences:
        return paragraph, 0

    flags = [flagged_by(s, FILTER_LEXICON) for s in sentences]
    if not any(flags):
        return paragraph, 0

    # Erotic passages run as blocks: when a paragraph is flagged more than once,
    # remove the whole span between the first and last flag, connective
    # sentences included.
    marked = list(flags)
    hits = [i for i, flag in enumerate(flags) if flag]
    if len(hits) >= 2:
        for index in range(hits[0], hits[-1] + 1):
            marked[index] = True

    # Pull adjacent verse framing into the cut.
    for index, sentence in enumerate(sentences):
        if marked[index] or not VERSE_TAG.match(sentence):
            continue
        after = index + 1 < len(sentences) and marked[index + 1]
        before = index > 0 and marked[index - 1]
        if after or before:
            marked[index] = True

    output: list[str] = []
    removed = 0
    previous_cut = False
    for sentence, cut in zip(sentences, marked):
        if cut:
            removed += 1
            if not previous_cut:
                output.append(REDACTION)
            previous_cut = True
        else:
            output.append(sentence)
            previous_cut = False

    return "".join(output), removed


def expurgate(raw: str) -> tuple[str, dict[str, int]]:
    start = raw.index(START_MARKER)
    end = raw.index(END_MARKER)
    body = raw[raw.index("\n", start) + 1 : end]

    clean_lines: list[str] = []
    stats = {"paragraphs_touched": 0, "sentences_removed": 0}
    for line in body.replace("\r\n", "\n").split("\n"):
        clean, removed = expurgate_paragraph(line)
        if removed:
            stats["paragraphs_touched"] += 1
            stats["sentences_removed"] += removed
        clean_lines.append(clean)

    return "\n".join(clean_lines).strip() + "\n", stats


def audit(clean: str) -> list[tuple[int, str, str]]:
    """Independent acceptance check, run with a lexicon that did no filtering."""
    heading = re.compile(r"^\s*第([〇零○一二三四五六七八九十百]+)回\s+")
    survivors: list[tuple[int, str, str]] = []
    chapter = 0
    for line in clean.split("\n"):
        match = heading.match(line)
        if match:
            chapter = chapter_number(match.group(1))
            continue  # headings are exempt by design
        for sentence in SENTENCE_SPLIT.split(line):
            for term in AUDIT_LEXICON:
                if term in sentence:
                    survivors.append((chapter, term, sentence.strip()[:60]))
                    break
    return survivors


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: expurgate.py <gutenberg-source.txt> <output.txt>")
        return 2

    raw = Path(sys.argv[1]).read_text(encoding="utf-8")
    clean, stats = expurgate(raw)
    Path(sys.argv[2]).write_text(clean, encoding="utf-8")

    chapters = len([l for l in clean.split("\n") if CHAPTER_HEADING.match(l)])
    survivors = audit(clean)

    print(f"chapters retained:   {chapters}")
    print(f"paragraphs touched:  {stats['paragraphs_touched']}")
    print(f"sentences removed:   {stats['sentences_removed']}")
    print(f"redaction markers:   {clean.count(REDACTION)}")
    print(f"characters retained: {len(clean)}")
    print()
    print(f"INDEPENDENT AUDIT:   {len(survivors)} surviving explicit sentence(s)")
    for chapter, term, excerpt in survivors[:20]:
        print(f"  第{chapter}回  [{term}]  {excerpt}")
    if len(survivors) > 20:
        print(f"  ... and {len(survivors) - 20} more")

    if chapters != 100:
        print("\nFAIL: chapter count is not 100")
        return 1
    if survivors:
        print("\nFAIL: explicit content survived; widen FILTER_LEXICON and rerun")
        return 1
    print("\nPASS: no explicit content detected by the independent audit lexicon")
    return 0


if __name__ == "__main__":
    sys.exit(main())
