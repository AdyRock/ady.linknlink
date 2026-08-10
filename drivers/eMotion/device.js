'use strict';

const Homey = require('homey');

const CAPABILITY_AVAILABILITY_MAP = {
	alarm_presence: ['Any Presence', 'all_area'],
	measure_temperature: ['temperature'],
	measure_humidity: ['humidity'],
	measure_luminance: ['brightness'],
	measure_signal_strength: ['wifi rssi'],
};

module.exports = class eMotionDevice extends Homey.Device
{

	/**
   * onInit is called when the device is initialized.
   */
	async onInit()
	{
		const did = this.getData().id;
		this.homey.app.registerDevice(did, this.driver.id);

		this.homey.app.updateLog('eMotionDevice has been initialized');
	}

	/**
   * onAdded is called when the user adds the device, called just after pairing.
   */
	async onAdded()
	{
		this.homey.app.updateLog('eMotionDevice has been added');
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
		this.homey.app.updateLog('eMotionDevice settings where changed');
	}

	/**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
	async onRenamed(name)
	{
		this.homey.app.updateLog('eMotionDevice was renamed');
	}

	/**
   * onDeleted is called when the user deleted the device.
   */
	async onDeleted()
	{
		const did = this.getData().id;
		this.homey.app.unregisterDevice(did);

		this.homey.app.updateLog('eMotionDevice has been deleted');
	}

	async processMQTTMessage(mqttMessage, value)
	{
		if (mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		// Log the device status
		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		if (mqttMessage.name === 'Any Presence' || mqttMessage.name === 'all_area')
		{
			this.setCapabilityValue('alarm_presence', value).catch(this.error);
			return true;
		}

		if (mqttMessage.name === 'temperature')
		{
			this.setCapabilityValue('measure_temperature', value).catch(this.error);
			return true;
		}

		if (mqttMessage.name === 'humidity')
		{
			this.setCapabilityValue('measure_humidity', value).catch(this.error);
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

	async processEntityAvailability(mqttMessage)
	{
		if (!mqttMessage || mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		for (const [capability, entityNames] of Object.entries(CAPABILITY_AVAILABILITY_MAP))
		{
			if (!entityNames.includes(mqttMessage.name))
			{
				continue;
			}

			const nextVisible = this.getAggregatedAvailability(entityNames);
			if (nextVisible === null)
			{
				continue;
			}

			await this.syncCapabilityVisibility(capability, nextVisible);
		}

		return true;
	}

	getAggregatedAvailability(entityNames)
	{
		const deviceId = this.getData().id;
		const entities = Array.from(this.homey.app.linknLinkAPI.entities.values())
			.filter((entity) => entity.deviceId === deviceId && entityNames.includes(entity.name));

		const knownStates = entities
			.map((entity) => entity.isAvailable)
			.filter((state) => typeof state === 'boolean');

		if (knownStates.length === 0)
		{
			return null;
		}

		return knownStates.some((state) => state === true);
	}

	async syncCapabilityVisibility(capability, shouldBeVisible)
	{
		const hasCapability = this.hasCapability(capability);

		if (shouldBeVisible && !hasCapability)
		{
			await this.addCapability(capability);
			this.homey.app.updateLog(`Added capability ${capability} on ${this.getName()} based on entity availability`, 1);
			return;
		}

		if (!shouldBeVisible && hasCapability)
		{
			await this.removeCapability(capability);
			this.homey.app.updateLog(`Removed capability ${capability} on ${this.getName()} based on entity availability`, 1);
		}
	}
};
