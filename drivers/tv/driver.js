'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class TVDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		this.deviceType = ['TV from eMotion Ultra', 'TV from eMotion Ultra2'];
		this.homey.app.updateLog('TV Driver has been initialized');
	}

	getIcon(modelNumber)
	{
		// the TV has different icons for different models that are stored in the root/assets folder
		// remove the '-' suffix if present
	}

};
