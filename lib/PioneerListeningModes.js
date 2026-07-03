'use strict';

const LISTENING_MODES = {
  '0001': 'Stereo',
  '0006': 'Auto Surround',
  '0007': 'Direct',
  '0008': 'Pure Direct',
  '0010': 'Dolby PLIIx Movie',
  '0054': 'THX',
  '0151': 'Auto Level Control (ALC)',
  '0152': 'Optimum Surround',
};

function listeningModeCodeToName(code) {
  return LISTENING_MODES[code] || `Onbekende modus (${code})`;
}

function listeningModeNameToCode(name) {
  const text = String(name || '').trim();

  return Object.keys(LISTENING_MODES).find(code => (
    LISTENING_MODES[code] === text
  ));
}

module.exports = {
  LISTENING_MODES,
  listeningModeCodeToName,
  listeningModeNameToCode,
};