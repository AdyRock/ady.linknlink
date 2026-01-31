'use strict';

const Homey = require('homey');

module.exports = class eMotionProDevice extends Homey.Device
{

	/**
   * onInit is called when the device is initialized.
   */
	async onInit()
	{
		const did = this.getData().id;
		this.homey.app.registerDevice(did, this.driver.id);

		this.homey.app.updateLog('eMotionProDevice has been initialized');
	}

	/**
   * onAdded is called when the user adds the device, called just after pairing.
   */
	async onAdded()
	{
		this.homey.app.updateLog('eMotionProDevice has been added');
	}

	/**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
	async onSettings({ oldSettings, newSettings, changedKeys })
	{
		this.homey.app.updateLog('eMotionProDevice settings where changed');
	}

	/**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
	async onRenamed(name)
	{
		this.homey.app.updateLog('eMotionProDevice was renamed');
	}

	/**
   * onDeleted is called when the user deleted the device.
   */
	async onDeleted()
	{
		const did = this.getData().id;
		this.homey.app.unregisterDevice(did);

		this.homey.app.updateLog('eMotionProDevice has been deleted');
	}

	async processMQTTMessage(mqttMessage, value)
	{
		if (mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		// Log the device status
		this.homey.app.updateLog(`eMotionUltraDevice MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		if (mqttMessage.name === 'all_area')
		{
			this.setCapabilityValue('alarm_presence', value).catch(this.error);
			return true;
		}
		if (mqttMessage.name === 'area_1')
		{
			this.setCapabilityValue('alarm_presence.zone1', value).catch(this.error);
			return true;
		}
		if (mqttMessage.name === 'area_2')
		{
			this.setCapabilityValue('alarm_presence.zone2', value).catch(this.error);
			return true;
		}
		if (mqttMessage.name === 'area_3')
		{
			this.setCapabilityValue('alarm_presence.zone3', value).catch(this.error);
			return true;
		}
		if (mqttMessage.name === 'area_4')
		{
			this.setCapabilityValue('alarm_presence.zone4', value).catch(this.error);
			return true;
		}
		if (mqttMessage.name === 'brightness')
		{
			this.setCapabilityValue('measure_luminance', value).catch(this.error);
			return true;
		}
		if (mqttMessage.name === 'wifi rssi')
		{
			this.setCapabilityValue('measure_signal_strength', parseInt(value, 10)).catch(this.error);
			return true;
		}
		return false;
	}
};
