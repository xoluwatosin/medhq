import { useCallback, useEffect, useRef, useState } from "react";
import { useHeardPath } from "@/components/heard/HeardBase";
import HeardPage from "@/components/heard/v2/HeardLayout";
import {
  HeardButton,
  HeardEmptyState,
  HeardLetterPaper,
  HeardLetterSkeleton,
  HeardLinkButton,
  HeardNotice,
} from "@/components/heard/v2/HeardKit";
import HeardSecretSignup from "@/components/heard/v2/HeardSecretSignup";
import { fetchPublicLetters, HeardPublicLetter, HEARD_ERRORS } from "@/components/heard/v2/heardSubmit";


const formatDate = (iso: string | null) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
};

/**
 * One letter at a time. Not a feed, not a grid, not a searchable archive.
 * Read through heard_public_letters, which returns published fields only.
 */
export const HeardLetterRoom = () => {
  const heardPath = useHeardPath();
  const [letters, setLetters] = useState<HeardPublicLetter[] | null>(null);
  const [current, setCurrent] = useState<HeardPublicLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const seen = useRef<string[]>([]);

  const pick = useCallback((pool: HeardPublicLetter[], exclude?: string) => {
    const unseen = pool.filter((l) => !seen.current.includes(l.public_ref));
    const choices = unseen.length ? unseen : pool.filter((l) => l.public_ref !== exclude);
    const from = choices.length ? choices : pool;
    if (!from.length) return null;
    if (!unseen.length) seen.current = [];
    const next = from[Math.floor(Math.random() * from.length)];
    seen.current.push(next.public_ref);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await fetchPublicLetters();
        if (!active) return;
        setLetters(rows);
        setCurrent(pick(rows));
      } catch (err) {
        console.error(err);
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pick]);

  const [fetching, setFetching] = useState(false);
  const [readCount, setReadCount] = useState(1);
  const onMore = () => {
    if (!letters?.length) return;
    setFetching(true);
    window.setTimeout(() => {
      setCurrent(pick(letters, current?.public_ref));
      setReadCount((n) => n + 1);
      setFetching(false);
    }, 320);
  };

  return (
    <HeardPage
      path="/letters"
      title="Letter Room — Heard"
      description="A letter from a stranger, for whoever finds it."
    >
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <span className="hv-index">Letter Room</span>
          <h1>Dear whoever needs this.</h1>
          <p className="text-[17px] text-[color:var(--hv-violet)]">
            A letter from a stranger, for whoever finds it.
          </p>
        </header>

        {failed && (
          <HeardNotice tone="problem" title={HEARD_ERRORS.generic}>
            The Letter Room could not be loaded just now.
          </HeardNotice>
        )}

        {(loading || fetching) && (
          <HeardLetterSkeleton label={loading ? "Finding you one" : "Finding another letter"} />
        )}

        {!loading && !fetching && current && (
          <>
            <HeardLetterPaper
              marker={`Letter ${readCount}`}
              date={formatDate(current.published_at)}
              heading={current.heading}
              body={current.content}
              signature={current.sign_it_as}
              stacked={(letters?.length ?? 0) > 1}
              edgeLabel="Letter Room"
            />
            <div className="flex flex-wrap items-center gap-4">
              {(letters?.length ?? 0) > 1 && <HeardButton type="button" onClick={onMore}>One more letter</HeardButton>}
              <HeardLinkButton to={heardPath("/letters/leave")} tone="pill">
                Leave a letter
              </HeardLinkButton>
            </div>
          </>
        )}

        {!loading && !fetching && !current && !failed && (
          <HeardEmptyState
            title="Nothing here right now."
            note="Come back another time."
            action={
              <HeardLinkButton to={heardPath("/letters/leave")}>Leave one instead</HeardLinkButton>
            }
          />
        )}


        <div className="pt-6 border-t border-[color:var(--hv-hair)]">
          <HeardSecretSignup />
        </div>
      </div>
    </HeardPage>
  );
};

export default HeardLetterRoom;
