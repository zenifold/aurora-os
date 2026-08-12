import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const RECENT_KEY = "aurora.emoji.recent";

const CATEGORIES: Record<string, string[]> = {
  Smileys: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😋","😛","🤪","😜","🤨","🧐","🤓","😎","🥸","🤗","🤔","🫡","🤐","😶","😏","😒","🙄","😬","🤥","😴","😷","🤒","🤕","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😢","😭","😡","🤬","🤯"],
  Gestures: ["👍","👎","👏","🙌","👐","🤝","🙏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤛","🤜","💪","🫶","💅"],
  Hearts: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"],
  Objects: ["🎉","🎊","🎁","🏆","🥇","🥈","🥉","🎯","🚀","✨","⭐","🌟","💫","🔥","💯","✅","☑️","❌","⚠️","💡","📌","📍","🔔","🔕","🛎️","💬","💭","🗯️","📝","📅","📆","⏰","⏳","🕐"],
  Food: ["🍕","🍔","🍟","🌭","🍿","🥨","🥪","🌮","🌯","🥗","🍝","🍜","🍣","🍱","🍤","🍙","🍚","🍛","🍲","🥘","🍳","🥞","🧇","🥓","🍞","🥐","🥖","🧀","🍎","🍊","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🍆","🥕","🌽","🌶️","🥒","🥬","🥦","🧄","🧅","🍄","🥜","☕","🍵","🥤","🧋","🍺","🍷","🥂","🍾"],
  Nature: ["🌸","🌺","🌻","🌹","🌷","🌼","💐","🌿","🍀","🌳","🌲","🌴","🌵","🌾","🌱","🌍","🌎","🌏","🌙","☀️","⛅","☁️","🌧️","⛈️","🌈","❄️","⛄","💧","🌊"],
};

export function EmojiPicker({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw) as string[]);
    } catch {/* ignore */}
  }, []);

  const all = useMemo(() => {
    const list: Array<[string, string[]]> = [];
    if (recent.length) list.push(["Recent", recent]);
    for (const [k, v] of Object.entries(CATEGORIES)) list.push([k, v]);
    return list;
  }, [recent]);

  const handlePick = (e: string) => {
    onPick(e);
    setRecent((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)].slice(0, 24);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {/* ignore */}
      return next;
    });
  };

  const filtered = q.trim()
    ? Object.values(CATEGORIES).flat().filter(() => true) // emoji has no name index — show all on search
    : null;

  return (
    <div className={cn("w-72 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-2 shadow-lg", className)}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search emoji…"
        className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      {filtered ? (
        <div className="grid grid-cols-8 gap-0.5">
          {filtered.map((e, i) => (
            <button key={i} onClick={() => handlePick(e)} className="rounded p-1 text-lg hover:bg-accent">{e}</button>
          ))}
        </div>
      ) : (
        all.map(([cat, list]) => (
          <div key={cat} className="mb-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</div>
            <div className="grid grid-cols-8 gap-0.5">
              {list.map((e, i) => (
                <button key={`${cat}-${i}`} onClick={() => handlePick(e)} className="rounded p-1 text-lg hover:bg-accent">{e}</button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
