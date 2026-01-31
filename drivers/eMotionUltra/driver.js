'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class eMotionUltraDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		this.deviceType = 'eMotion Ultra';
		this.homey.app.updateLog('eMotionUltraDriver has been initialized');
	}

	getIcon(modelNumber)
	{
		// the motion sensor has different icons for different models that are stored in the root/assest folder
		// remove the '-' suffix if present
	}

};
