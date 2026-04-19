'use strict';

const Homey = require('homey');

const CAPABILITY_TO_ENTITY = {
	tv_power: 'power',
	tv_av: 'tv_av',
	tv_home: 'home',
	tv_back: 'back',
	tv_menu: 'menu',
	tv_ok: 'ok',
	tv_up: 'up',
	tv_down: 'down',
	tv_left: 'left',
	tv_right: 'right',
	volume_up: 'volume_up',
	volume_down: 'volume_down',
	tv_mute: 'mute',
	channel_up: 'channel_up',
	channel_down: 'channel_down',
};

const ENTITY_TO_CAPABILITY = {};

module.exports = class TVDevice extends Homey.Device
{

	/**
   * onInit is called when the device is initialized.
   */
	async onInit()
	{
		const did = this.getData().id;
		this.homey.app.registerDevice(did, this.driver.id);
		this.registerTVCapabilityListeners();

		this.homey.app.updateLog('TVDevice has been initialized');
	}

	/**
   * onAdded is called when the user adds the device, called just after pairing.
   */
	async onAdded()
	{
		this.homey.app.updateLog('TVDevice has been added');
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
		this.homey.app.updateLog('TVDevice settings where changed');
	}

	/**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
	async onRenamed(name)
	{
		this.homey.app.updateLog('TVDevice was renamed');
	}

	/**
   * onDeleted is called when the user deleted the device.
   */
	async onDeleted()
	{
		const did = this.getData().id;
		this.homey.app.unregisterDevice(did);

		this.homey.app.updateLog('TVDevice has been deleted');
	}

	registerTVCapabilityListeners()
	{
		for (const capability of Object.keys(CAPABILITY_TO_ENTITY))
		{
			this.registerCapabilityListener(capability, async (value) => this.handleCapabilityChange(capability, value));
		}
	}

	async handleCapabilityChange(capability, value)
	{
		const entityName = CAPABILITY_TO_ENTITY[capability];
		const entity = this.getEntityByName(entityName);

		if (!entity)
		{
			throw new Error(`No MQTT entity found for capability ${capability}`);
		}

		const config = entity.rawConfig || {};
		const commandTopic = config.command_topic;

		if (!commandTopic)
		{
			throw new Error(`No command topic found for entity ${entityName}`);
		}

		const payload = this.getCommandPayload(capability, value, config);
		if (payload === null)
		{
			this.homey.app.updateLog(`Ignoring inactive button event for ${capability}`);
			return;
		}

		await this.homey.app.linknLinkAPI.publishMQTTMessage(commandTopic, payload, false, false);
	}

	getEntityByName(entityName)
	{
		const deviceId = this.getData().id;
		for (const entity of this.homey.app.linknLinkAPI.entities.values())
		{
			if (entity.deviceId === deviceId && entity.name === entityName)
			{
				return entity;
			}
		}

		return null;
	}

	getCommandPayload(capability, value, config)
	{
		if (capability === 'tv_power')
		{
			if (!value)
			{
				return null;
			}

			return config.payload_press ?? config.payload_on ?? 'PRESS';
		}

		if (capability === 'tv_mute')
		{
			if (!value)
			{
				return null;
			}

			return config.payload_press ?? config.payload_on ?? 'PRESS';
		}

		if (!value)
		{
			return null;
		}

		return config.payload_press ?? 'PRESS';
	}

	normalizeBooleanValue(value)
	{
		if (typeof value === 'boolean')
		{
			return value;
		}

		if (typeof value === 'number')
		{
			return value !== 0;
		}

		const normalized = String(value).trim().toLowerCase();
		return ['1', 'on', 'true', 'yes'].includes(normalized);
	}

	async processMQTTMessage(mqttMessage, value)
	{
		if (mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		// Log the device status
		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		const capability = ENTITY_TO_CAPABILITY[mqttMessage.name];
		if (!capability)
		{
			return false;
		}

		const normalizedValue = this.normalizeBooleanValue(value);
		if (this.getCapabilityValue(capability) !== normalizedValue)
		{
			await this.setCapabilityValue(capability, normalizedValue);
		}

		return true;
	}
};
