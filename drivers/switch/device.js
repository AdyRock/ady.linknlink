'use strict';

const Homey = require('homey');
const { syncCapabilitiesByEntityNameMap } = require('../capabilityVisibility');

const SWITCH_ENTITY_NAME = 'switch  from eMotion Ultra';

const CAPABILITY_AVAILABILITY_MAP = {
	'button.on': [SWITCH_ENTITY_NAME],
	'button.off': [SWITCH_ENTITY_NAME],
};

module.exports = class SwitchDevice extends Homey.Device

{

	async onInit()

	{

		const did = this.getData().id;

		this.homey.app.registerDevice(did, this.driver.id);

		this.registerCapabilityListener('button.on', () => this.pressSwitch(true));

		this.registerCapabilityListener('button.off', () => this.pressSwitch(false));

		this.homey.app.updateLog('SwitchDevice has been initialized');

	}

	async onAdded()

	{

		this.homey.app.updateLog('SwitchDevice has been added');

	}

	async onSettings({ oldSettings, newSettings, changedKeys })

	{

		this.homey.app.updateLog('SwitchDevice settings were changed');

	}

	async onRenamed(name)

	{

		this.homey.app.updateLog('SwitchDevice was renamed');

	}

	async onDeleted()

	{

		const did = this.getData().id;

		this.homey.app.unregisterDevice(did);

		this.homey.app.updateLog('SwitchDevice has been deleted');

	}

	async pressSwitch(on)

	{

		const entity = this.getSwitchEntity();

		if (!entity)

		{

			throw new Error('No switch entity found for this device');

		}

		const config = entity.rawConfig || {};

		if (!config.command_topic)

		{

			throw new Error('No command_topic found for switch entity');

		}

		// payload_on/off are JSON strings as sent by the firmware

		const payload = on ? config.payload_on : config.payload_off;

		await this.homey.app.linknLinkAPI.publishMQTTMessage(config.command_topic, payload, false, false);

	}

	getSwitchEntity()

	{

		const deviceId = this.getData().id;

		for (const entity of this.homey.app.linknLinkAPI.entities.values())

		{

			if (entity.deviceId === deviceId && entity.name === SWITCH_ENTITY_NAME)

			{

				return entity;

			}

		}

		return null;

	}

	async processMQTTMessage(mqttMessage)

	{

		if (mqttMessage.deviceId !== this.getData().id)

		{

			return false;

		}

		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name}`);

		// No state feedback from IR remote; switch and button entities are command-only.

		if (mqttMessage.name === SWITCH_ENTITY_NAME || mqttMessage.name === 'on' || mqttMessage.name === 'off')

		{

			return true;

		}

		return false;

	}

	async processEntityAvailability(mqttMessage)

	{

		return syncCapabilitiesByEntityNameMap(this, mqttMessage, CAPABILITY_AVAILABILITY_MAP);

	}

};
