/* eslint-disable no-tabs */
/* eslint-disable no-nested-ternary */
/* jslint node: true */

'use strict';

const Homey = require('homey');
/**
 * Base class for drivers
 * @class
 * @extends {Homey.Driver}
 */

module.exports = class LinknLinkDriver extends Homey.Driver
{

	async onPair(session)
	{
		session.setHandler('list_devices', async () =>
		{
			this.log('list_devices');
			const deviceList = await this.homey.app.linknLinkAPI.getDeviceList();

			// deviceList is a Map, so get the device objects from its values
			const devices = Array.from(deviceList.values());

			// Filter the list to just include devices of this type. If the this.deviceType id '' then call the findModelTraits function to check if the device has the traits of this driver.
			// If the this.deviceType is an array then check if the device model is included in the array. If the this.deviceType is a string then check if the device model is equal to the string.
			const filteredList = devices.filter((device) => (Array.isArray(this.deviceType)
				? this.deviceType.includes(device.model)
				: device.model === this.deviceType || (this.deviceType === '' && this.findModelTraits(device))));
			return filteredList.map((device) => ({
				name: device.name,
				data:
				{
					id: device.deviceId,
					model: device.model,
				},
				icon: this.getIcon ? this.getIcon(device.modelName) : null,
				settings: {
					serviceZone: device.serviceZone ? device.serviceZone : (device.modelName?.endsWith('-EC') ? 'eu_uk' : 'us'),
				},
			}));
		});
	}

	async getState(data, settings)
	{
		// return this.homey.app.linknlink.getDeviceStatus(data.UAID, data.model, data.id, data.deviceToken, settings.serviceZone);
	}

};
