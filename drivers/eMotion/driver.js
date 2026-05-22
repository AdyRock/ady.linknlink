'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class eMotionDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		// Use trait matching because the original eMotion model name is not yet fully verified.
		this.deviceType = '';
		this.homey.app.updateLog('eMotionDriver has been initialized');
	}

	findModelTraits(device)
	{
		const model = `${device?.model || ''}`;
		const modelLower = model.toLowerCase();
		if (!modelLower.includes('emotion'))
		{
			return false;
		}

		if (/emotion\s*(pro|ultra|ultra2|max)/i.test(model))
		{
			return false;
		}

		const entityKeys = Array.from(device?.entities || []);
		const entityNames = entityKeys
			.map((entityKey) => this.homey.app.linknLinkAPI.entities.get(entityKey)?.name)
			.filter(Boolean);

		const supportedTraitNames = ['all_area', 'Any Presence', 'temperature', 'humidity', 'brightness'];
		const matched = entityNames.some((entityName) => supportedTraitNames.includes(entityName));

		if (matched)
		{
			this.homey.app.updateLog(`eMotionDriver matched model "${model}" using traits: ${entityNames.join(', ')}`, 0);
		}

		return matched;
	}

	getIcon(modelNumber)
	{
		// the motion sensor has different icons for different models that are stored in the root/assest folder
		// remove the '-' suffix if present
	}

};
