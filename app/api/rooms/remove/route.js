import { route, roomByCode, must } from '@/lib/api';
export const POST = route(async ({ user, body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  if (room.host_id !== user.id || room.status !== 'lobby') throw new Error('Not allowed');
  if (body.userId === user.id) throw new Error('Host cannot be removed');
  must(await admin.from('game_players').delete().eq('room_id', room.id).eq('user_id', body.userId));
});
