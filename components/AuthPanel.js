"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPanel({ onDone, title }) {
  const sb = useState(() => createClient())[0];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const done = ({ error }) => (error ? setErr(error.message) : onDone());

  const guest = () =>
    name.trim()
      ? sb.auth
          .signInAnonymously({
            options: { data: { username: name.trim().slice(0, 20) } },
          })
          .then(done)
      : setErr("Enter a display name");
  const google = () =>
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.href },
    });
  const emailLogin = async () => {
    let r = await sb.auth.signInWithPassword({ email, password });
    if (r.error)
      r = await sb.auth.signUp({
        email,
        password,
        options: { data: { username: email.split("@")[0] } },
      });
    done(r);
  };

  return (
    <div className="card space-y-3 text-left">
      {title && <h2 className="text-xl font-bold">{title}</h2>}
      {err && <p className="text-red-400">{err}</p>}
      <input
        className="input"
        placeholder="Enter your name to play as guest"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn w-full" onClick={guest}>
        Continue as Guest
      </button>
      <button className="btn-ghost w-full" onClick={google}>
        Continue with Google
      </button>
      <input
        className="input"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="btn-ghost w-full" onClick={emailLogin}>
        Sign in / Sign up with email
      </button>
    </div>
  );
}
