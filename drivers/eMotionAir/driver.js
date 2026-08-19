'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class eMotionAirDriver extends LinknLinkDriver
{
	async onInit()
	{
		this.deviceType = 'eMotion Air';
		this.homey.app.updateLog('eMotionAirDriver has been initialized');
	}
};
