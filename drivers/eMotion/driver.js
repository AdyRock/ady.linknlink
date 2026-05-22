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

		// Keep explicit Pro/Ultra/Max variants on their dedicated drivers.
		if (/(pro|ultra|ultra2|max)/i.test(model))
		{
			return false;
		}

		const entityKeys = Array.from(device?.entities || []);
		const entityNames = entityKeys
			.map((entityKey) => this.homey.app.linknLinkAPI.entities.get(entityKey)?.name)
			.filter(Boolean);

		const hasOGPresenceTrait = entityNames.includes('all_area');
		const hasProUltraPresenceTraits = entityNames.includes('Any Presence') || entityNames.includes('Zone 1 Presence');

		const isModelCandidate = modelLower.includes('emotion') || modelLower.includes('presence sensor');
		const matched = isModelCandidate && hasOGPresenceTrait && !hasProUltraPresenceTraits;

		if (matched)
		{
			this.homey.app.updateLog(`eMotionDriver matched model "${model}" using traits: ${entityNames.join(', ')}`, 0);
		}
		else
		{
			this.homey.app.updateLog(`eMotionDriver rejected model "${model}" using traits: ${entityNames.join(', ')}`, 1);
		}

		return matched;
	}

	getIcon(modelNumber)
	{
		// the motion sensor has different icons for different models that are stored in the root/assest folder
		// remove the '-' suffix if present
	}

};
