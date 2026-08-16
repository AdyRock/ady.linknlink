'use strict';

const Homey = require('homey');
const { syncCapabilitiesByEntityNameMap } = require('../capabilityVisibility');

// eMotion Max publishes the same functions with different entity names
const ENTITY_NAME_ALIASES = {
	zone_all_area: 'Any Presence',
	zone_1: 'Zone 1 Presence',
	zone_2: 'Zone 2 Presence',
	zone_3: 'Zone 3 Presence',
	zone_4: 'Zone 4 Presence',
	'Persons in Detection Range': 'All Target Counts',
};

const CAPABILITY_AVAILABILITY_MAP = {
	alarm_presence: ['Any Presence', 'zone_all_area'],
	measure_people_count: ['All Target Counts', 'Persons in Fenced Zones', 'Persons in Detection Range'],
	'alarm_presence.zone1': ['Zone 1 Presence', 'zone_1'],
	'measure_people_count.zone1': ['Zone 1 Target Counts'],
	'alarm_presence.zone2': ['Zone 2 Presence', 'zone_2'],
	'measure_people_count.zone2': ['Zone 2 Target Counts'],
	'alarm_presence.zone3': ['Zone 3 Presence', 'zone_3'],
	'measure_people_count.zone3': ['Zone 3 Target Counts'],
	'alarm_presence.zone4': ['Zone 4 Presence', 'zone_4'],
	'measure_people_count.zone4': ['Zone 4 Target Counts'],
	measure_temperature: ['temperature'],
	measure_humidity: ['humidity'],
	measure_luminance: ['brightness'],
	measure_signal_strength: ['wifi rssi'],
};

module.exports = class eMotionUltraDevice extends Homey.Device
{

	/**
   * onInit is called when the device is initialized.
   */
	async onInit()
	{
		const did = this.getData().id;
		this.homey.app.registerDevice(did, this.driver.id);

		this.homey.app.updateLog('eMotionUltraDevice has been initialized');
	}

	/**
   * onAdded is called when the user adds the device, called just after pairing.
   */
	async onAdded()
	{
		this.homey.app.updateLog('eMotionUltraDevice has been added');
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
		this.homey.app.updateLog('eMotionUltraDevice settings where changed');
	}

	/**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
	async onRenamed(name)
	{
		this.homey.app.updateLog('eMotionUltraDevice was renamed');
	}

	/**
   * onDeleted is called when the user deleted the device.
   */
	async onDeleted()
	{
		const did = this.getData().id;
		this.homey.app.unregisterDevice(did);

		this.homey.app.updateLog('eMotionUltraDevice has been deleted');
	}

	async processMQTTMessage(mqttMessage, value)
	{
		if (mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		// Log the device status
		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		const aliasName = ENTITY_NAME_ALIASES[mqttMessage.name];
		if (aliasName)
		{
			return this.processMQTTMessage({ ...mqttMessage, name: aliasName }, value);
		}

		if (mqttMessage.name === 'Any Presence')
		{
			this.setCapabilityValue('alarm_presence', value).catch(this.error);
			return true;
		}

		if (mqttMessage.name === 'All Target Counts' || mqttMessage.name === 'Persons in Fenced Zones')
		{
			value = parseInt(value, 10);
			if (this.getCapabilityValue('measure_people_count') !== value)
			{
				this.setCapabilityValue('measure_people_count', value).catch(this.error);
				this.homey.app.trigger_measure_people_count_changed(this);
			}
			return true;
		}

		if (mqttMessage.name === 'Zone 1 Presence')
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

		if (mqttMessage.name === 'Zone 1 Target Counts')
		{
			value = parseInt(value, 10);
			if (this.getCapabilityValue('measure_people_count.zone1') !== value)
			{
				this.setCapabilityValue('measure_people_count.zone1', value).catch(this.error);
				this.homey.app.trigger_measure_people_count_zone1_changed(this);
			}
			return true;
		}

		if (mqttMessage.name === 'Zone 2 Presence')
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

		if (mqttMessage.name === 'Zone 2 Target Counts')
		{
			value = parseInt(value, 10);
			if (this.getCapabilityValue('measure_people_count.zone2') !== value)
			{
				this.setCapabilityValue('measure_people_count.zone2', value).catch(this.error);
				this.homey.app.trigger_measure_people_count_zone2_changed(this);
			}
			return true;
		}

		if (mqttMessage.name === 'Zone 3 Presence')
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

		if (mqttMessage.name === 'Zone 3 Target Counts')
		{
			value = parseInt(value, 10);
			if (this.getCapabilityValue('measure_people_count.zone3') !== value)
			{
				this.setCapabilityValue('measure_people_count.zone3', value).catch(this.error);
				this.homey.app.trigger_measure_people_count_zone3_changed(this);
			}
			return true;
		}

		if (mqttMessage.name === 'Zone 4 Presence')
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

		if (mqttMessage.name === 'Zone 4 Target Counts')
		{
			value = parseInt(value, 10);
			if (this.getCapabilityValue('measure_people_count.zone4') !== value)
			{
				this.setCapabilityValue('measure_people_count.zone4', value).catch(this.error);
				this.homey.app.trigger_measure_people_count_zone4_changed(this);
			}
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
		return syncCapabilitiesByEntityNameMap(this, mqttMessage, CAPABILITY_AVAILABILITY_MAP);
	}
};
