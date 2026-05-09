export const BAG_COLOURS = ['YELLOW', 'RED', 'BLUE', 'GREEN'];

export const BAG_HEX = {
  YELLOW: '#FFD700',
  RED: '#EF4444',
  BLUE: '#3B82F6',
  GREEN: '#22C55E',
};

export const BAG_LABEL = {
  YELLOW: 'Yellow',
  RED: 'Red',
  BLUE: 'Blue',
  GREEN: 'Green',
};

const LAST_TEAM_COLOUR_KEY = 'pt_cornhole_last_team_colour';
const LAST_PLAYER_COLOUR_KEY = (playerId) => `pt_cornhole_last_player_colour:${playerId}`;

export function getLastTeamColour(team) {
  try {
    const raw = localStorage.getItem(LAST_TEAM_COLOUR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[team] || null;
  } catch {
    return null;
  }
}

export function rememberTeamColours(team1Colour, team2Colour) {
  localStorage.setItem(
    LAST_TEAM_COLOUR_KEY,
    JSON.stringify({ 1: team1Colour, 2: team2Colour }),
  );
}

export function getLastPlayerColour(playerId) {
  return localStorage.getItem(LAST_PLAYER_COLOUR_KEY(playerId)) || null;
}

export function rememberPlayerColour(playerId, colour) {
  localStorage.setItem(LAST_PLAYER_COLOUR_KEY(playerId), colour);
}
