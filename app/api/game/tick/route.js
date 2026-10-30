import { route, roomByCode, must } from '@/lib/api';
// Server-side timer enforcement: any member may poke it; the DB decides whether the deadline passed.
export const POST = route(async ({ body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  must(await admin.rpc('tick', { p_room: room.id }));
});
