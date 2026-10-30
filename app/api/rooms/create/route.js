import { route, must } from '@/lib/api';
import { validateConfig } from '@/lib/validations';
import { makeRoomCode } from '@/lib/game-utils';
const name = (u) => u.user_metadata?.username || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Player';
export const POST = route(async ({ user, body, admin }) => {
  const errors = validateConfig(body);
  if (errors.length) throw new Error(errors.join('; '));
  let room;
  for (let i = 0; i < 5 && !room; i++) {
    const { data } = await admin.from('game_rooms').insert({
      room_code: makeRoomCode(), host_id: user.id, max_players: body.maxPlayers, imposter_count: body.imposterCount,
      total_rounds: body.totalRounds, turn_time_limit: body.turnTimeLimit, word_category: body.wordCategory,
      hint_enabled: !!body.hintEnabled, custom_hint: body.customHint?.slice(0, 40) || null,
      hint_difficulty: body.hintDifficulty || 'Easy', allow_host_to_play: !!body.hostPlays,
    }).select().single();
    room = data;
  }
  if (!room) throw new Error('Could not create room');
  must(await admin.from('game_players').insert({
    room_id: room.id, user_id: user.id, display_name: body.displayName?.slice(0, 20) || name(user),
    is_host: true, is_ready: true, is_playing: !!body.hostPlays,
  }));
  return { roomCode: room.room_code };
});
