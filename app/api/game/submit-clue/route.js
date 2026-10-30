import { route, roomByCode, must } from '@/lib/api';
import { cleanClue } from '@/lib/validations';
export const POST = route(async ({ user, body, admin }) => {
  const clue = cleanClue(body.clue);
  if (!clue) throw new Error('Clue required');
  const room = await roomByCode(admin, body.roomCode);
  must(await admin.rpc('submit_clue', { p_room: room.id, p_user: user.id, p_clue: clue }));
});
