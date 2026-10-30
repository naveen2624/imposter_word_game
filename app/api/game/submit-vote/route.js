import { route, roomByCode, must } from '@/lib/api';
export const POST = route(async ({ user, body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  must(await admin.rpc('submit_vote', { p_room: room.id, p_user: user.id, p_target: body.targetId }));
});
