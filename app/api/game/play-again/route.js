import { route, roomByCode, must } from "@/lib/api";
export const POST = route(async ({ user, body, admin }) => {
  const room = await roomByCode(admin, body.roomCode);
  must(await admin.rpc("play_again", { p_room: room.id, p_user: user.id }));
});
