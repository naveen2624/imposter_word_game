"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ghost, Users, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthPanel from "@/components/AuthPanel";

export default function Home() {
  const sb = useState(() => createClient())[0];
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const refresh = () =>
    sb.auth.getUser().then(({ data }) => setUser(data.user));
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line

  const join = async () => {
    const r = await fetch("/api/rooms/join", {
      method: "POST",
      body: JSON.stringify({ roomCode: code }),
    });
    const j = await r.json();
    j.error ? setErr(j.error) : router.push(`/room/${j.roomCode}`);
  };

  return (
    <div className="space-y-6 pt-10 text-center">
      <Ghost className="mx-auto h-16 w-16 text-violet-400" />
      <h1 className="text-5xl font-extrabold">IMPOSTER</h1>
      <p className="text-slate-300">
        Everyone gets the secret word — except the imposters. Give clues, stay
        sneaky, then vote.
      </p>
      {err && <p className="text-red-400">{err}</p>}
      {!user ? (
        <AuthPanel onDone={refresh} />
      ) : (
        <div className="card space-y-3">
          <button
            className="btn w-full"
            onClick={() => router.push("/create-game")}
          >
            <Users className="mr-2 inline h-4 w-4" />
            Create Game
          </button>
          <div className="flex gap-2">
            <input
              className="input uppercase"
              placeholder="ROOM CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn-ghost" onClick={join}>
              <LogIn className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <div className="card text-left text-sm text-slate-300">
        <b>How to play:</b> 1) Everyone reads their private role. 2) Take turns
        giving one-word clues. 3) Vote for who you think the imposters are.
        Players win only if <i>every</i> imposter is caught.
      </div>
    </div>
  );
}
