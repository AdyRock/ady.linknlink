'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class SwitchDriver extends LinknLinkDriver
{
	async onInit()
	{
		this.deviceType = '';
		this.homey.app.updateLog('SwitchDriver has been initialized');
	}

	findModelTraits(device)
	{
		// Match on presence of the switch entity name sent by the firmware.
		const entities = Array.from(device.entities);
		return entities.some((entityKey) =>
		{
			const entity = this.homey.app.linknLinkAPI.entities.get(entityKey);
			return entity && entity.name === 'switch  from eMotion Ultra';
		});
	}

};
