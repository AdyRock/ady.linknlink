'use strict';

const LinknLinkDriver = require('../linknlinkDriver');

module.exports = class ACRemoteDriver extends LinknLinkDriver
{
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit()
	{
		this.deviceType = [
			' from eMotion Ultra',
			' from eMotion Ultra2',
			'AC from eMotion Ultra',
			'AC from eMotion Ultra2',
			'AC Remote from eMotion Ultra',
			'AC Remote from eMotion Ultra2',
			'Air Conditioner from eMotion Ultra',
			'Air Conditioner from eMotion Ultra2',
		];
		this.homey.app.updateLog('ACRemoteDriver has been initialized');
	}

	getIcon(modelNumber)
	{
		// The AC remote icon is defined in driver assets.
	}
};
