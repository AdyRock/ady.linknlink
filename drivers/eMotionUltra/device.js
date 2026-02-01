'use strict';

const Homey = require('homey');

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

		if (mqttMessage.name === 'Any Presence')
		{
			this.setCapabilityValue('alarm_presence', value).catch(this.error);
			return true;
		}

		if (mqttMessage.name === 'All Target Counts')
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
};
