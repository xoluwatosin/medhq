"""Which edge functions a push changed, for the deploy workflow.

A function counts as changed when a file in its own folder changed, or when a
shared file it imports (directly or through another shared file) changed.
Prints `functions=<names separated by spaces>` for $GITHUB_OUTPUT.
"""
import os
import re
import subprocess

ROOT = "supabase/functions"
IMPORT = re.compile(r"""from\s+["'](\.{1,2}/[^"']+)["']""")


def functions():
    return sorted(
        d for d in os.listdir(ROOT)
        if not d.startswith("_") and os.path.isfile(os.path.join(ROOT, d, "index.ts"))
    )


def local_imports(path, seen=None):
    """Every file under supabase/functions that `path` imports, transitively."""
    seen = set() if seen is None else seen
    try:
        source = open(path, encoding="utf-8").read()
    except OSError:
        return seen
    for target in IMPORT.findall(source):
        resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
        if resolved not in seen:
            seen.add(resolved)
            local_imports(resolved, seen)
    return seen


def changed_files():
    before, after = os.environ.get("BEFORE", ""), os.environ.get("AFTER", "HEAD")
    if not before or set(before) == {"0"}:
        before = f"{after}~1"
    out = subprocess.run(
        ["git", "diff", "--name-only", before, after],
        capture_output=True, text=True, check=True,
    ).stdout
    return {line.strip() for line in out.splitlines() if line.strip()}


def main():
    names = functions()
    requested = os.environ.get("REQUESTED", "").split()
    if requested:
        chosen = names if requested == ["all"] else [n for n in requested if n in names]
    else:
        changed = changed_files()
        if "supabase/config.toml" in changed:
            # A login rule may have changed; redeploying everything applies it.
            chosen = names
        else:
            chosen = []
            for name in names:
                entry = os.path.join(ROOT, name, "index.ts")
                own = any(f.startswith(f"{ROOT}/{name}/") for f in changed)
                shared = any(dep in changed for dep in local_imports(entry))
                if own or shared:
                    chosen.append(name)
    print(f"functions={' '.join(chosen)}")


if __name__ == "__main__":
    main()
