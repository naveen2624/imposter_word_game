import { route, roomByCode } from '@/lib/api';
export const GET = route(async ({ user, req, admin }) => {
  const room = await roomByCode(admin, new URL(req.url).searchParams.get('room'));
  const { data: mem } = await admin.from('game_players').select('id').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();
  if (!mem) throw new Error('Forbidden');
  if (room.status !== 'finished') throw new Error('Game not finished');
  const [{ data: result }, { data: secret }, { data: roles }, { data: votes }] = await Promise.all([
    admin.from('game_results').select('*').eq('room_id', room.id).single(),
    admin.from('game_secrets').select('secret_word').eq('room_id', room.id).single(),
    admin.from('game_roles').select('user_id,role').eq('room_id', room.id),
    admin.from('player_votes').select('voter_id,voted_player_id,voting_round').eq('room_id', room.id),
  ]);
  return { result, word: secret.secret_word, roles, votes };
});
