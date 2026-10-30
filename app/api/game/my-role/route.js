import { route, roomByCode } from '@/lib/api';
export const GET = route(async ({ user, req, admin }) => {
  const room = await roomByCode(admin, new URL(req.url).searchParams.get('room'));
  if (room.status === 'lobby') throw new Error('Game not started');
  const { data: me } = await admin.from('game_roles').select('role').eq('room_id', room.id).eq('user_id', user.id).single();
  if (!me) throw new Error('You are not in this game');
  const { data: s } = await admin.from('game_secrets').select('secret_word,hint,category').eq('room_id', room.id).single();
  // Each caller only ever receives their own view of the secret.
  return me.role === 'imposter'
    ? { role: 'imposter', hint: room.hint_enabled ? s.hint : null }
    : { role: 'player', word: s.secret_word, category: s.category };
});
