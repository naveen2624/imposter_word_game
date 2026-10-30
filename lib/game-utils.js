const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeRoomCode = () => Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join('');
