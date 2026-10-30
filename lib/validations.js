export const CATEGORIES = ['Random','Fruits','Animals','Movies','Technology','Countries','Sports','Food','Professions','Objects'];
const int = (v, a, z) => Number.isInteger(v) && v >= a && v <= z;
export function validateConfig(b = {}) {
  const errors = [];
  if (!int(b.maxPlayers, 3, 10)) errors.push('maxPlayers must be 3-10');
  if (!int(b.imposterCount, 1, 3)) errors.push('imposterCount must be 1-3');
  if (int(b.maxPlayers, 3, 10) && b.imposterCount >= b.maxPlayers) errors.push('imposters must be fewer than players');
  if (!int(b.totalRounds, 1, 10)) errors.push('totalRounds must be 1-10');
  if (![15, 30, 45, 60].includes(b.turnTimeLimit)) errors.push('turnTimeLimit must be 15/30/45/60');
  if (!CATEGORIES.includes(b.wordCategory)) errors.push('invalid category');
  if (!['Easy', 'Medium', 'Hard'].includes(b.hintDifficulty || 'Easy')) errors.push('invalid hint difficulty');
  return errors;
}
export const cleanClue = (s) => String(s || '').trim().slice(0, 40);
