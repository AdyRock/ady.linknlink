'use strict';

const Homey = require('homey');
const { syncCapabilitiesByEntityNameMap } = require('../capabilityVisibility');

const CAPABILITY_AVAILABILITY_MAP = {
	alarm_presence: ['motion'],
	measure_temperature: ['temperature'],
	measure_humidity: ['humidity'],
	measure_luminance: ['illuminance'],
	measure_battery: ['battery'],
	measure_signal_strength: ['rssi'],
};

module.exports = class eMotionAirDevice extends Homey.Device
{
	async onInit()
	{
		const did = this.getData().id;
		this.homey.app.registerDevice(did, this.driver.id);
		this.homey.app.updateLog('eMotionAirDevice has been initialized');
	}

	async onDeleted()
	{
		this.homey.app.unregisterDevice(this.getData().id);
		this.homey.app.updateLog('eMotionAirDevice has been deleted');
	}

	async processMQTTMessage(mqttMessage, value, rawValue, json)
	{
		if (mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		const capabilityMap = {
			motion: 'alarm_presence',
			temperature: 'measure_temperature',
			humidity: 'measure_humidity',
			illuminance: 'measure_luminance',
			battery: 'measure_battery',
			rssi: 'measure_signal_strength',
		};
		const capability = capabilityMap[mqttMessage.name];
		if (capability)
		{
			const capabilityValue = capability === 'alarm_presence' ? value : Number(value);
			if (capabilityValue !== undefined && (capability === 'alarm_presence' || Number.isFinite(capabilityValue)))
			{
				this.setCapabilityValue(capability, capabilityValue).catch(this.error);
			}
			return true;
		}

		if (mqttMessage.name === 'button')
		{
			const eventType = json?.event_type || json?.event || json?.type || (typeof value === 'string' ? value : rawValue);
			return this.homey.app.triggerEMotionAirButtonEvent(this, eventType);
		}

		return false;
	}

	async processEntityAvailability(mqttMessage)
	{
		return syncCapabilitiesByEntityNameMap(this, mqttMessage, CAPABILITY_AVAILABILITY_MAP);
	}
};
