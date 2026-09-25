import json, collections, re
import pglast, pglast.stream
from pglast import ast

import os
SQL = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.sql"), encoding="utf-8").read()
stmts = pglast.parse_sql(SQL)
print("parsed statements:", len(stmts))

def val(n):
    if isinstance(n, ast.A_Const):
        if n.isnull:
            return None
        v = n.val
        return getattr(v, "sval", None) if isinstance(v, ast.String) else getattr(v, "ival", getattr(v, "boolval", None))
    if isinstance(n, ast.TypeCast):
        return val(n.arg)
    return None

cats = {}  # (game, name) -> premium
questions = []
eng_re = re.compile(r"\b(the|and|you|your|with|dare|truth|night)\b", re.I)
for rs in stmts:
    s = rs.stmt
    if not isinstance(s, ast.InsertStmt):
        continue
    tbl = s.relation.relname
    sel = s.selectStmt
    if tbl == "categories":
        vals = sel.fromClause[0].larg.subquery.valuesLists
        for r in vals:
            r = [val(x) for x in r]
            cats[(r[0], r[1])] = bool(r[5])
    if tbl == "questions":
        # game slug from join condition text
        frm = sel.fromClause[0]
        game = None
        txt = pglast.stream.RawStream()(sel)
        game = re.search(r"g\.slug = '([a-z_]+)'", txt).group(1)
        vals = frm
        while not isinstance(vals, ast.RangeSubselect):
            vals = vals.larg
        for r in vals.subquery.valuesLists:
            cat, text, kind, lvl, mood, opts, timer = [val(x) for x in r]
            questions.append(dict(game=game, cat=cat, text=text, kind=kind, level=lvl, mood=mood, options=json.loads(opts), timer=timer))

print("categories:", len(cats))
by = collections.defaultdict(collections.Counter)
problems = []
for qq in questions:
    g = qq["game"]
    by[g][qq["level"]] += 1
    if qq["mood"] not in ("romantik", "eglenceli", "flortoz", "cesur", "gizemli", "karisik"):
        problems.append(("mood", qq))
    n = len(qq["options"])
    exp = {"would_you_rather": 2, "this_or_that": 2, "know_me": 4}.get(g, 0)
    if n != exp:
        problems.append(("options", qq))
    if g == "this_or_that" and any(len(o) > 22 for o in qq["options"]):
        problems.append(("tot len", qq))
    if g == "truth_dare" and qq["kind"] not in ("truth", "dare"):
        problems.append(("kind", qq))
    if g != "truth_dare" and qq["kind"] is not None:
        problems.append(("kind!", qq))
    if qq["timer"] is not None and not (30 <= qq["timer"] <= 300):
        problems.append(("timer", qq))
    if not (2 <= len(qq["text"]) <= 600):
        problems.append(("len", qq))
    if eng_re.search(qq["text"] + " " + " ".join(qq["options"])):
        problems.append(("english?", qq))

print("total questions:", len(questions))
print(f"{'game':18} {'L0':>4}{'L1':>4}{'L2':>4}{'L3':>4}{'tot':>5}  free(L0-1,non-prem)")
for g, c in by.items():
    tot = sum(c.values())
    free = sum(1 for qq in questions if qq["game"] == g and qq["level"] <= 1 and not cats[(g, qq["cat"])])
    pct = " ".join(f"{100*c[l]/tot:.0f}%" for l in range(4))
    print(f"{g:18} {c[0]:>4}{c[1]:>4}{c[2]:>4}{c[3]:>4}{tot:>5}  {free:>3}   [{pct}]")
td = collections.Counter(qq["kind"] for qq in questions if qq["game"] == "truth_dare")
print("truth/dare:", dict(td))
ch = [qq for qq in questions if qq["game"] == "challenges"]
print("challenges timed:", sum(1 for x in ch if x["timer"]), "untimed:", sum(1 for x in ch if not x["timer"]))
dup = [t for t, n in collections.Counter(qq["text"] + json.dumps(qq["options"], ensure_ascii=False) for qq in questions).items() if n > 1]
print("duplicates:", dup)
print("problems:", len(problems))
for p in problems:
    print(p)
