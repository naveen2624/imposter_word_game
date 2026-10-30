"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Copy, Crown, Check, Timer, Skull } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthPanel from "@/components/AuthPanel";

const post = (url, body) =>
  fetch(url, { method: "POST", body: JSON.stringify(body) }).then((r) =>
    r.json(),
  );

export default function Room({ params }) {
  const { roomCode } = use(params);
  const sb = useState(() => createClient())[0];
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [clues, setClues] = useState([]);
  const [role, setRole] = useState(null);
  const [results, setResults] = useState(null);
  const [clue, setClue] = useState("");
  const [left, setLeft] = useState(0);
  const [err, setErr] = useState("");
  const [checked, setChecked] = useState(false);
  const ticking = useRef(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await sb.auth.getUser();
    setMe(user);
    setChecked(true);
    if (!user) return;
    const { data: r } = await sb
      .from("game_rooms")
      .select("*")
      .eq("room_code", roomCode)
      .maybeSingle();
    setRoom(r);
    if (!r) return;
    if (r.status === "lobby") {
      setRole(null);
      setResults(null);
    }

    const [p, c] = await Promise.all([
      sb
        .from("game_players")
        .select("*")
        .eq("room_id", r.id)
        .order("joined_at"),
      sb
        .from("player_clues")
        .select("*")
        .eq("room_id", r.id)
        .order("submitted_at"),
    ]);
    setPlayers(p.data || []);
    setClues(c.data || []);
    if (r.status !== "lobby" && r.status !== "closed")
      setRole(
        await fetch(`/api/game/my-role?room=${roomCode}`).then((x) => x.json()),
      );
    if (r.status === "finished")
      setResults(
        await fetch(`/api/game/results?room=${roomCode}`).then((x) => x.json()),
      );
  }, [sb, roomCode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Realtime is only a "something changed" signal; Postgres stays the source of truth.
    if (!room?.id) return;
    const ch = sb.channel(`room-${room.id}`);
    ["game_rooms", "game_players", "player_clues", "game_results"].forEach(
      (table) =>
        ch.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter:
              table === "game_rooms"
                ? `id=eq.${room.id}`
                : `room_id=eq.${room.id}`,
          },
          load,
        ),
    );
    ch.subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [room?.id, sb, load]);

  useEffect(() => {
    if (room?.status !== "playing") return;
    const t = setInterval(() => {
      const ms = new Date(room.turn_deadline) - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms < -500 && !ticking.current) {
        ticking.current = true;
        post("/api/game/tick", { roomCode }).finally(() => {
          ticking.current = false;
          load();
        });
      }
    }, 500);
    return () => clearInterval(t);
  }, [room, roomCode, load]);

  const act = async (url, body) => {
    const j = await post(url, { roomCode, ...body });
    setErr(j.error || "");
    load();
  };
  const name = (id) =>
    players.find((p) => p.user_id === id)?.display_name || "?";

  if (!checked) return null;
  if (!me) return <AuthPanel title={`Join room ${roomCode}`} onDone={load} />;

  if (!room)
    return (
      <div className="card space-y-3 text-center">
        <p>
          Room <b>{roomCode}</b>
        </p>
        {err && <p className="text-red-400">{err}</p>}
        <button
          className="btn"
          onClick={async () => {
            const j = await post("/api/rooms/join", { roomCode });
            j.error ? setErr(j.error) : load();
          }}
        >
          Join room
        </button>
      </div>
    );

  const isHost = room.host_id === me?.id;
  const mine = players.find((p) => p.user_id === me?.id);
  const link = typeof window !== "undefined" ? location.href : "";
  const share = () =>
    navigator.share
      ? navigator.share({ title: "IMPOSTER", url: link })
      : navigator.clipboard.writeText(link);
  const active = room.turn_order?.[room.current_turn];

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">ROOM CODE</div>
          <div className="text-3xl font-bold tracking-widest">
            {room.room_code}
          </div>
        </div>
        <button className="btn-ghost" onClick={share}>
          <Copy className="mr-1 inline h-4 w-4" />
          Invite
        </button>
      </div>
      {err && <p className="text-red-400">{err}</p>}

      {room.status === "lobby" && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-400">
            {players.length}/{room.max_players} · {room.imposter_count}{" "}
            imposter(s) · {room.total_rounds} rounds · {room.turn_time_limit}s ·{" "}
            {room.word_category}
          </p>
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
            >
              <span>
                {p.is_host && (
                  <Crown className="mr-1 inline h-4 w-4 text-yellow-400" />
                )}
                {p.display_name}
                {!p.is_playing && " (controller)"}
              </span>
              <span className="flex items-center gap-2">
                {p.is_ready && <Check className="h-4 w-4 text-green-400" />}
                {isHost && !p.is_host && (
                  <button
                    className="text-xs text-red-400"
                    onClick={() =>
                      act("/api/rooms/remove", { userId: p.user_id })
                    }
                  >
                    remove
                  </button>
                )}
              </span>
            </div>
          ))}
          {mine && !mine.is_host && (
            <button
              className="btn w-full"
              onClick={() => act("/api/rooms/ready", { ready: !mine.is_ready })}
            >
              {mine.is_ready ? "Joined ✓ (tap to leave)" : "Join game"}
            </button>
          )}
          {isHost && (
            <button
              className="btn w-full"
              onClick={() => act("/api/rooms/start")}
            >
              Start game
            </button>
          )}
        </div>
      )}

      {["playing", "voting"].includes(room.status) && role?.role && (
        <div
          className={`card pop text-center ${role.role === "imposter" ? "border-red-500/60" : "border-green-500/40"}`}
        >
          {role.role === "imposter" ? (
            <>
              <Skull className="mx-auto text-red-400" />
              <b className="text-red-400">You are the IMPOSTER</b>
              <p className="text-sm">
                You don&apos;t know the word.
                {role.hint && (
                  <>
                    {" "}
                    Hint: <b>{role.hint}</b>
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">{role.category}</p>
              <b className="text-3xl">{role.word}</b>
            </>
          )}
        </div>
      )}

      {room.status === "playing" && (
        <div className="card space-y-3">
          <div className="flex justify-between">
            <span>
              Round {room.current_round}/{room.total_rounds}
            </span>
            <span className="text-yellow-400">
              <Timer className="mr-1 inline h-4 w-4" />
              {left}s
            </span>
          </div>
          <p>
            Turn: <b>{name(active)}</b>
          </p>
          {active === me?.id && (
            <div className="flex gap-2">
              <input
                className="input"
                maxLength={40}
                value={clue}
                onChange={(e) => setClue(e.target.value)}
                placeholder="Your clue"
              />
              <button
                className="btn"
                onClick={() => {
                  act("/api/game/submit-clue", { clue });
                  setClue("");
                }}
              >
                Send
              </button>
            </div>
          )}
          {clues.slice(-1).map((c) => (
            <div key={c.id} className="rounded-xl bg-white/5 p-3 text-sm">
              Latest clue · <b>{name(c.user_id)}</b>:{" "}
              {c.is_skipped ? <i>skipped</i> : c.clue}
            </div>
          ))}
        </div>
      )}

      {room.status === "voting" && (
        <div className="card space-y-2">
          <b>{room.voting_round === 2 ? "Revote — " : ""}Who is an imposter?</b>
          {room.candidates
            .filter((id) => id !== me?.id)
            .map((id) => (
              <button
                key={id}
                className="btn-ghost w-full"
                onClick={() => act("/api/game/submit-vote", { targetId: id })}
              >
                {name(id)}
              </button>
            ))}
          {isHost && (
            <button
              className="btn-ghost w-full text-yellow-400"
              onClick={() => act("/api/game/close-voting")}
            >
              Close voting now
            </button>
          )}
        </div>
      )}

      {room.status === "finished" && results?.result && (
        <div className="card pop space-y-2 text-center">
          <h2
            className={`text-3xl font-extrabold ${results.result.winning_team === "players" ? "text-green-400" : "text-red-400"}`}
          >
            {results.result.winning_team === "players"
              ? "Players win!"
              : "Imposters win!"}
          </h2>
          <p>
            The word was <b>{results.word}</b>
          </p>
          <p className="text-red-400">
            Imposters: {results.result.imposter_ids.map(name).join(", ")}
          </p>
          <div className="text-sm text-slate-300">
            {players.map((p) => (
              <div key={p.id}>
                {p.display_name}:{" "}
                {results.result.vote_summary?.[p.user_id] || 0} vote(s)
              </div>
            ))}
          </div>
          {clues.map((c) => (
            <div key={c.id} className="text-xs text-slate-400">
              R{c.round_number} {name(c.user_id)}:{" "}
              {c.is_skipped ? "skipped" : c.clue}
            </div>
          ))}

          {isHost ? (
            <button
              className="btn w-full"
              onClick={() => act("/api/game/play-again")}
            >
              Play again with same players
            </button>
          ) : (
            <p className="text-sm text-slate-400">
              Waiting for the host to start a new game…
            </p>
          )}
        </div>
      )}

      {room.status === "closed" && (
        <p className="card text-center">Room closed by host.</p>
      )}
    </div>
  );
}
