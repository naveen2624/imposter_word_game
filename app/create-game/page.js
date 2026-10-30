'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/validations';

export default function CreateGame() {
  const router = useRouter();
  const [f, setF] = useState({ maxPlayers: 6, imposterCount: 1, totalRounds: 2, turnTimeLimit: 30, wordCategory: 'Random', hintEnabled: true, hintDifficulty: 'Easy', hostPlays: true, customHint: '' });
  const [err, setErr] = useState('');
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async () => {
    const r = await fetch('/api/rooms/create', { method: 'POST', body: JSON.stringify(f) });
    const j = await r.json();
    j.error ? setErr(j.error) : router.push(`/room/${j.roomCode}`);
  };
  const Sel = ({ k, label, opts }) => (
    <label className="block text-sm">{label}
      <select className="input mt-1" value={f[k]} onChange={set(k, typeof opts[0] === 'number')}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );
  return (
    <div className="card space-y-3">
      <h1 className="text-2xl font-bold">Game settings</h1>
      <Sel k="maxPlayers" label="Max players" opts={[3, 4, 5, 6, 7, 8, 9, 10]} />
      <Sel k="imposterCount" label="Imposters" opts={[1, 2, 3]} />
      <Sel k="totalRounds" label="Rounds" opts={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
      <Sel k="turnTimeLimit" label="Seconds per turn" opts={[15, 30, 45, 60]} />
      <Sel k="wordCategory" label="Category" opts={CATEGORIES} />
      <Sel k="hintDifficulty" label="Hint difficulty" opts={['Easy', 'Medium', 'Hard']} />
      <label className="flex gap-2"><input type="checkbox" checked={f.hintEnabled} onChange={set('hintEnabled')} /> Imposter hints</label>
      <input className="input" placeholder="Custom hint (optional)" value={f.customHint} onChange={set('customHint')} />
      <label className="flex gap-2"><input type="checkbox" checked={f.hostPlays} onChange={set('hostPlays')} /> I will play (otherwise I only control the game)</label>
      {err && <p className="text-red-400">{err}</p>}
      <button className="btn w-full" onClick={submit}>Create room</button>
    </div>
  );
}
