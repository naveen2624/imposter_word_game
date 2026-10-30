import { route, roomByCode, must } from '@/lib/api';
export const POST = route(async ({ user, body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  const { data: existing } = await admin.from('game_players').select('id').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();
  if (existing) return { roomCode: room.room_code }; // rejoin after refresh
  if (room.status !== 'lobby') throw new Error('Game already started');
  const { count } = await admin.from('game_players').select('*', { count: 'exact', head: true }).eq('room_id', room.id).eq('is_playing', true);
  if (count >= room.max_players) throw new Error('Room is full');
  const display = (body.displayName || user.user_metadata?.username || user.email?.split('@')[0] || 'Player').slice(0, 20);
  must(await admin.from('game_players').insert({ room_id: room.id, user_id: user.id, display_name: display }));
  return { roomCode: room.room_code };
});
