'use strict';

const Homey = require('homey');
const { syncCapabilitiesByEntityNameMap } = require('../capabilityVisibility');

const ENTITY_NAMES = {
	allArea: ['all_area', 'Any Presence'],
	zone1: ['area_1', 'Zone 1 Presence'],
	zone2: ['area_2', 'Zone 2 Presence'],
	zone3: ['area_3', 'Zone 3 Presence'],
	zone4: ['area_4', 'Zone 4 Presence'],
};

const CAPABILITY_AVAILABILITY_MAP = {
	alarm_presence: ENTITY_NAMES.allArea,
	'alarm_presence.zone1': ENTITY_NAMES.zone1,
	'alarm_presence.zone2': ENTITY_NAMES.zone2,
	'alarm_presence.zone3': ENTITY_NAMES.zone3,
	'alarm_presence.zone4': ENTITY_NAMES.zone4,
	measure_luminance: ['brightness'],
	measure_signal_strength: ['wifi rssi'],
};

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
		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		if (ENTITY_NAMES.allArea.includes(mqttMessage.name))
		{
			this.setCapabilityValue('alarm_presence', value).catch(this.error);
			return true;
		}

		if (ENTITY_NAMES.zone1.includes(mqttMessage.name))
		{
			if (this.getCapabilityValue('alarm_presence.zone1') !== value)
			{
				this.setCapabilityValue('alarm_presence.zone1', value).catch(this.error);
				if (value === true)
				{
					this.homey.app.trigger_alarm_presence_zone1_true(this);
				}
				else
				{
					this.homey.app.trigger_alarm_presence_zone1_false(this);
				}
			}
			return true;
		}

		if (ENTITY_NAMES.zone2.includes(mqttMessage.name))
		{
			if (this.getCapabilityValue('alarm_presence.zone2') !== value)
			{
				this.setCapabilityValue('alarm_presence.zone2', value).catch(this.error);
				if (value === true)
				{
					this.homey.app.trigger_alarm_presence_zone2_true(this);
				}
				else
				{
					this.homey.app.trigger_alarm_presence_zone2_false(this);
				}
			}
			return true;
		}

		if (ENTITY_NAMES.zone3.includes(mqttMessage.name))
		{
			if (this.getCapabilityValue('alarm_presence.zone3') !== value)
			{
				this.setCapabilityValue('alarm_presence.zone3', value).catch(this.error);
				if (value === true)
				{
					this.homey.app.trigger_alarm_presence_zone3_true(this);
				}
				else
				{
					this.homey.app.trigger_alarm_presence_zone3_false(this);
				}
			}
			return true;
		}

		if (ENTITY_NAMES.zone4.includes(mqttMessage.name))
		{
			if (this.getCapabilityValue('alarm_presence.zone4') !== value)
			{
				this.setCapabilityValue('alarm_presence.zone4', value).catch(this.error);
				if (value === true)
				{
					this.homey.app.trigger_alarm_presence_zone4_true(this);
				}
				else
				{
					this.homey.app.trigger_alarm_presence_zone4_false(this);
				}
			}
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
		return syncCapabilitiesByEntityNameMap(this, mqttMessage, CAPABILITY_AVAILABILITY_MAP);
	}
};
