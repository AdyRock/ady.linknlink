'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class ACRemoteDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		this.deviceType = '';
		this.homey.app.updateLog('ACRemoteDriver has been initialized');
	}

	findModelTraits(device)
	{
		// the AC remote has different traits for different models, so we need to find the traits based on the entities array of the device
		// So for an AC remote we need to check if there is a 'climate:*' where the * is the deviceId.
		const entities = Array.from(device.entities);
		if (entities.some((entity) => (entity.startsWith(`climate:${device.deviceId}`))))
		{
			return true;
		}

		return false;
	}

	getIcon(modelNumber)
	{
		// The AC remote icon is defined in driver assets.
	}
};
