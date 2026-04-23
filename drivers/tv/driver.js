'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class TVDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		this.deviceType = '';
		this.homey.app.updateLog('TV Driver has been initialized');
	}

	findModelTraits(device)
	{
		// the TV has different traits for different models, so we need to find the traits based on the entities array of the device
		// So for a TV we need to check if there is a 'button:*_tv_av' or 'button:*channel_up' entity where the * is the deviceId.
		const entities = Array.from(device.entities);

		if (entities.some((entity) => entity.startsWith(`button:${device.deviceId}_tv_av`)))
		{
			return true;
		}
		if (entities.some((entity) => entity.startsWith(`button:${device.deviceId}_channel_up`)))
		{
			return true;
		}

		return false;
	}

	getIcon(modelNumber)
	{
		// uses the driver icon
	}

};
