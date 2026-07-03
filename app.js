'use strict';

const Homey = require('homey');

class PioneerLegacyApp extends Homey.App {
  async onInit() {
    this.log('Pioneer Legacy app initialized');
  }
}

module.exports = PioneerLegacyApp;