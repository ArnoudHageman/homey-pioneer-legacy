'use strict';

const Homey = require('homey');

class PioneerScLx87Driver extends Homey.Driver {

  async onInit() {
    this.log('Pioneer SC-LX87 driver initialized');
  }

  async onPairListDevices() {
    return [
      {
        name: 'Pioneer SC-LX87',
        data: {
          id: 'pioneer-sc-lx87',
        },
        settings: {
          ip: '192.168.1.228',
          port: 8102,
          timeout: 2000,
        },
      },
    ];
  }

}

module.exports = PioneerScLx87Driver;