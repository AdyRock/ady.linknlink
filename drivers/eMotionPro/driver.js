'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class eMotionProDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		// eMotion Max 3 uses the same capability profile as eMotion Pro.
		this.deviceType = ['eMotion Pro', 'eMotion Max 3'];
		this.homey.app.updateLog('eMotionProDriver has been initialized');
	}

	getIcon(modelNumber)
	{
		// the motion sensor has different icons for different models that are stored in the root/assest folder
		// remove the '-' suffix if present
	}

};
