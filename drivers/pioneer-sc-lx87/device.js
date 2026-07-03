'use strict';

const Homey = require('homey');
const net = require('net');

const { sourceCodeToName } = require('../../lib/PioneerSources');

const {
  listeningModeCodeToName,
  listeningModeNameToCode,
} = require('../../lib/PioneerListeningModes');

class PioneerScLx87Device extends Homey.Device {
  async onInit() {
    this.log('Pioneer Legacy initialized');

    this.currentStatus = {
      power: null,
      source: null,
      sourceCode: null,
      volumeDb: null,
      mute: null,
      listeningMode: null,
      listeningModeCode: null,
    };

    this.registerCapabilityListeners();
    this.registerFlowListeners();
  }

  registerCapabilityListeners() {
    this.registerCapabilityListener('onoff', async value => {
      await this.sendCommand(value ? 'PO' : 'PF');
      await this.setCapabilityValue('onoff', value);

      this.currentStatus.power = value;
      await this.setAvailable();

      return true;
    });

    this.registerCapabilityListener('volume_mute', async value => {
      await this.sendCommand(value ? 'MO' : 'MF');
      await this.setCapabilityValue('volume_mute', value);

      this.currentStatus.mute = value;
      await this.setAvailable();

      return true;
    });

    this.registerCapabilityListener('volume_up', async () => {
      await this.sendCommand('VU');
      return true;
    });

    this.registerCapabilityListener('volume_down', async () => {
      await this.sendCommand('VD');
      return true;
    });
  }

  registerFlowListeners() {
    this.homey.flow.getActionCard('select_source')
      .registerRunListener(async args => this.selectSource(args.source));

    this.homey.flow.getActionCard('select_listening_mode')
      .registerRunListener(async args => this.selectListeningMode(args.listening_mode));

    this.homey.flow.getActionCard('set_volume_db')
      .registerRunListener(async args => this.setVolumeDb(args.volume_db));

    this.homey.flow.getActionCard('sync_status')
      .registerRunListener(async () => this.syncStatus());

    this.homey.flow.getActionCard('diagnose_status')
      .registerRunListener(async () => this.diagnoseStatus());

    this.homey.flow.getActionCard('diagnose_source')
      .registerRunListener(async () => this.diagnoseSource());

    this.homey.flow.getActionCard('debug_command')
      .registerRunListener(async args => this.debugCommand(args.command));
  }

  async selectSource(source) {
    const command = this.getSourceCommand(source);

    await this.sendCommand(command);

    const sourceCode = this.commandToSourceCode(command);

    this.currentStatus.sourceCode = sourceCode;
    this.currentStatus.source = sourceCodeToName(sourceCode);

    return true;
  }

  async selectListeningMode(listeningMode) {
    const modeCode = this.getListeningModeCode(listeningMode);

    if (!modeCode) {
      throw new Error(`Ongeldige luistermodus: ${JSON.stringify(listeningMode)}`);
    }

    await this.sendCommand(`${modeCode}SR`);

    this.currentStatus.listeningModeCode = modeCode;
    this.currentStatus.listeningMode = listeningModeCodeToName(modeCode);

    return true;
  }

  async setVolumeDb(volumeDb) {
    const db = Number(volumeDb);
    const command = this.volumeDbToCommand(db);

    await this.sendCommand(command);

    this.currentStatus.volumeDb = this.clampVolumeDb(db);

    return true;
  }

  async syncStatus() {
    try {
      const status = await this.readStatus();

      this.currentStatus = status;

      if (status.power !== null) {
        await this.setCapabilityValue('onoff', status.power);
      }

      if (status.mute !== null) {
        await this.setCapabilityValue('volume_mute', status.mute);
      }

      await this.setAvailable();
      this.logStatus(status, 'Pioneer status sync');

      return true;
    } catch (err) {
      this.error(`Status sync failed: ${err.message}`);
      await this.setUnavailable(`Status synchroniseren mislukt: ${err.message}`);
      throw err;
    }
  }

  async diagnoseStatus() {
    const status = await this.readStatus();

    this.currentStatus = status;

    const message =
      `Pioneer diagnose\n` +
      `Power: ${this.boolToAanUit(status.power)} (${status.raw.power || 'geen antwoord'})\n` +
      `Bron: ${status.source || 'Onbekend'} (${status.raw.source || 'geen antwoord'})\n` +
      `Volume: ${status.volumeDb !== null ? `${status.volumeDb} dB` : 'Onbekend'} (${status.raw.volume || 'geen antwoord'})\n` +
      `Mute: ${this.boolToAanUit(status.mute)} (${status.raw.mute || 'geen antwoord'})\n` +
      `Listening: ${status.listeningMode || 'Onbekend'} (${status.raw.listeningMode || 'geen antwoord'})`;

    this.log(message);

    return true;
  }

  async diagnoseSource() {
    const sourceResponse = await this.sendCommand('?F');
    const sourceCode = this.parseSourceCode(sourceResponse);
    const source = sourceCodeToName(sourceCode);

    const message =
      `Pioneer diagnose bron\n` +
      `Command: ?F\n` +
      `Source raw: ${sourceResponse || 'geen antwoord'}\n` +
      `Source: ${source} (${sourceCode || 'geen code'})`;

    this.log(message);

    return true;
  }

  async debugCommand(command) {
    const cleanCommand = String(command || '').trim();

    if (!cleanCommand) {
      throw new Error('Geen debug-opdracht ingevuld');
    }

    const response = await this.sendCommand(cleanCommand);

    const message =
      `Pioneer debug\n` +
      `Command: ${cleanCommand}\n` +
      `Response: ${response || 'geen antwoord'}`;

    this.log(message);

    return true;
  }

  async readStatus() {
    const powerResponse = await this.sendCommand('?P');
    const sourceResponse = await this.sendCommand('?F');
    const volumeResponse = await this.sendCommand('?V');
    const muteResponse = await this.sendCommand('?M');
    const listeningModeResponse = await this.sendCommand('?S');

    const sourceCode = this.parseSourceCode(sourceResponse);
    const listeningModeCode = this.parseListeningModeCode(listeningModeResponse);

    return {
      power: this.parsePower(powerResponse),
      source: sourceCodeToName(sourceCode),
      sourceCode,
      volumeDb: this.parseVolumeDb(volumeResponse),
      mute: this.parseMute(muteResponse),
      listeningMode: listeningModeCodeToName(listeningModeCode),
      listeningModeCode,
      raw: {
        power: powerResponse,
        source: sourceResponse,
        volume: volumeResponse,
        mute: muteResponse,
        listeningMode: listeningModeResponse,
      },
    };
  }

  logStatus(status, title) {
    this.log(`--- ${title} ---`);
    this.log(`Power raw: ${status.raw.power}`);
    this.log(`Power: ${this.boolToAanUit(status.power)}`);
    this.log(`Source raw: ${status.raw.source}`);
    this.log(`Source: ${status.source} (${status.sourceCode || 'geen code'})`);
    this.log(`Volume raw: ${status.raw.volume}`);
    this.log(`Volume dB: ${status.volumeDb !== null ? status.volumeDb : 'Onbekend'}`);
    this.log(`Mute raw: ${status.raw.mute}`);
    this.log(`Mute: ${this.boolToAanUit(status.mute)}`);
    this.log(`Listening raw: ${status.raw.listeningMode}`);
    this.log(`Listening: ${status.listeningMode} (${status.listeningModeCode || 'geen code'})`);
  }

  getSourceCommand(source) {
    if (typeof source === 'string') return source;
    if (source && typeof source.id === 'string') return source.id;
    if (source && typeof source.value === 'string') return source.value;

    throw new Error(`Ongeldige bron: ${JSON.stringify(source)}`);
  }

  getListeningModeCode(listeningMode) {
    if (typeof listeningMode === 'string') {
      return listeningModeNameToCode(listeningMode);
    }

    if (listeningMode && typeof listeningMode.id === 'string') {
      return listeningModeNameToCode(listeningMode.id);
    }

    if (listeningMode && typeof listeningMode.value === 'string') {
      return listeningModeNameToCode(listeningMode.value);
    }

    return null;
  }

  boolToAanUit(value) {
    if (value === true) return 'Aan';
    if (value === false) return 'Uit';
    return 'Onbekend';
  }

  parsePower(response) {
    const text = String(response || '');

    if (text.includes('PWR0')) return true;
    if (text.includes('PWR1')) return false;

    return null;
  }

  parseMute(response) {
    const text = String(response || '');

    if (text.includes('MUT0')) return true;
    if (text.includes('MUT1')) return false;

    return null;
  }

  parseSourceCode(response) {
    const text = String(response || '');

    const match = text.match(/FN(\d{2})/);
    if (match) return match[1];

    const reverseMatch = text.match(/(\d{2})FN/);
    if (reverseMatch) return reverseMatch[1];

    return null;
  }

  commandToSourceCode(command) {
    const text = String(command || '');
    const match = text.match(/^(\d{2})FN$/);

    if (match) return match[1];

    return null;
  }

  parseVolumeDb(response) {
    const text = String(response || '');
    const match = text.match(/VOL(\d{3})/);

    if (!match) return null;

    const pioneerValue = Number(match[1]);

    if (Number.isNaN(pioneerValue)) return null;

    return (pioneerValue - 161) / 2;
  }

  parseListeningModeCode(response) {
    const text = String(response || '');
    const match = text.match(/SR(\d{4})/);

    if (!match) return null;

    return match[1];
  }

  clampVolumeDb(db) {
    return Math.max(-80, Math.min(12, db));
  }

  volumeDbToCommand(db) {
    if (Number.isNaN(db)) {
      throw new Error('Ongeldige volume waarde');
    }

    const clampedDb = this.clampVolumeDb(db);
    const pioneerValue = Math.round((clampedDb * 2) + 161);

    return `${String(pioneerValue).padStart(3, '0')}VL`;
  }

  sendCommand(command) {
    const ip = this.getSetting('ip') || '192.168.1.228';
    const port = Number(this.getSetting('port') || 8102);
    const timeout = Number(this.getSetting('timeout') || 2000);

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      let response = '';
      let settled = false;

      const finish = result => {
        if (settled) return;

        settled = true;
        socket.destroy();
        resolve(result);
      };

      const fail = err => {
        if (settled) return;

        settled = true;
        socket.destroy();
        reject(err);
      };

      socket.setTimeout(timeout);

      socket.on('data', data => {
        response += data.toString();
      });

      socket.on('error', err => {
        fail(err);
      });

      socket.on('timeout', () => {
        if (response) {
          finish(response);
        } else {
          fail(new Error('Timeout'));
        }
      });

      socket.connect(port, ip, () => {
        this.log(`Sending: ${command} to ${ip}:${port}`);
        socket.write(`${command}\r`);

        setTimeout(() => {
          finish(response || true);
        }, 700);
      });
    });
  }
}

module.exports = PioneerScLx87Device;