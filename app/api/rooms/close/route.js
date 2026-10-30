import { route, roomByCode, must } from '@/lib/api';
export const POST = route(async ({ user, body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  if (room.host_id !== user.id) throw new Error('Only the host can close the room');
  must(await admin.from('game_rooms').update({ status: 'closed' }).eq('id', room.id));
});
