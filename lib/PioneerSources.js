'use strict';

const SOURCES = {
  '01': 'CD',
  '05': 'TV/SAT',
  '10': 'VIDEO1',
  '14': 'VIDEO2',
  '15': 'DVR/BDR',
  '17': 'USB',
  '19': 'HDMI1',
  '20': 'HDMI2',
  '21': 'HDMI3',
  '22': 'HDMI4',
  '23': 'HDMI5',
  '24': 'HDMI6',
  '25': 'BD/DVD',
  '26': 'NETWORK',
};

function sourceCodeToName(code) {
  return SOURCES[String(code)] || 'Onbekende bron';
}

function sourceNameToCode(name) {
  const entry = Object.entries(SOURCES).find(
    ([, value]) => value === name
  );

  return entry ? entry[0] : null;
}

module.exports = {
  SOURCES,
  sourceCodeToName,
  sourceNameToCode,
};