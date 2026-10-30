import { route, roomByCode, must } from '@/lib/api';
export const POST = route(async ({ user, body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  if (room.status !== 'lobby') throw new Error('Game already started');
  must(await admin.from('game_players').update({ is_ready: !!body.ready }).eq('room_id', room.id).eq('user_id', user.id));
});
