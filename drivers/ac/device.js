'use strict';

const Homey = require('homey');
const { syncCapabilitiesByEntityMatcher } = require('../capabilityVisibility');

const CAPABILITIES = [
	'onoff',
	'target_temperature',
	'ac_mode',
	'ac_fan',
];

const CLIMATE_ENTITY_NAMES = [
	'AC from eMotion Ultra',
	'AC from eMotion Ultra2',
];

module.exports = class ACRemoteDevice extends Homey.Device
{
	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit()
	{
		const did = this.getData().id;
		this.acState = {
			pwr: undefined,
			temp: undefined,
			envtemp: undefined,
			ac_mode: undefined,
			ac_mark: undefined,
		};

		this.homey.app.registerDevice(did, this.driver.id);
		this.registerACCapabilityListeners();

		this.homey.app.updateLog('ACRemoteDevice has been initialized');
	}

	/**
	 * onAdded is called when the user adds the device, called just after pairing.
	 */
	async onAdded()
	{
		this.homey.app.updateLog('ACRemoteDevice has been added');
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
		this.homey.app.updateLog('ACRemoteDevice settings where changed');
	}

	/**
	 * onRenamed is called when the user updates the device's name.
	 * This method can be used this to synchronise the name to the device.
	 * @param {string} name The new name
	 */
	async onRenamed(name)
	{
		this.homey.app.updateLog('ACRemoteDevice was renamed');
	}

	/**
	 * onDeleted is called when the user deleted the device.
	 */
	async onDeleted()
	{
		const did = this.getData().id;
		this.homey.app.unregisterDevice(did);

		this.homey.app.updateLog('ACRemoteDevice has been deleted');
	}

	registerACCapabilityListeners()
	{
		for (const capability of CAPABILITIES)
		{
			this.registerCapabilityListener(capability, async (value) => this.handleCapabilityChange(capability, value));
		}
	}

	async handleCapabilityChange(capability, value)
	{
		const entity = this.getClimateEntity();

		if (!entity)
		{
			throw new Error('No MQTT climate entity found for AC device');
		}

		const config = entity.rawConfig || {};
		const command = this.getCommandForCapability(capability, value, config);
		if (!command || !command.topic)
		{
			throw new Error(`No command topic available for capability ${capability}`);
		}

		await this.homey.app.linknLinkAPI.publishMQTTMessage(command.topic, command.payload, false, false);
	}

	getClimateEntity()
	{
		const deviceId = this.getData().id;
		for (const entity of this.homey.app.linknLinkAPI.entities.values())
		{
			if (entity.deviceId !== deviceId)
			{
				continue;
			}

			if (entity.component === 'climate')
			{
				return entity;
			}

			if (CLIMATE_ENTITY_NAMES.includes(entity.name))
			{
				return entity;
			}
		}

		return null;
	}

	getModes(config)
	{
		const rawModes = Array.isArray(config.modes) ? config.modes.filter((m) => m !== 'off') : ['auto', 'cool', 'heat', 'dry', 'fan_only'];
		return rawModes.filter((mode) => typeof mode === 'string');
	}

	getFanModes(config)
	{
		const rawModes = Array.isArray(config.fan_modes) ? config.fan_modes : ['auto', 'low', 'medium', 'high'];
		return rawModes.filter((mode) => typeof mode === 'string');
	}

	getCommandForCapability(capability, value, config)
	{
		if (capability === 'onoff')
		{
			if (typeof value !== 'boolean')
			{
				return null;
			}

			const nextPower = value ? 1 : 0;
			this.acState.pwr = nextPower;
			return {
				topic: config.command_topic,
				payload: JSON.stringify({ pwr: nextPower }),
			};
		}

		if (capability === 'target_temperature')
		{
			const nextTemp = Number(value);
			if (!Number.isFinite(nextTemp))
			{
				return null;
			}

			this.acState.temp = nextTemp;
			return {
				topic: config.temperature_command_topic || config.command_topic,
				payload: JSON.stringify({ temp: nextTemp }),
			};
		}

		if (capability === 'ac_mode')
		{
			const modes = this.getModes(config);
			let selectedMode = String(value || '').trim();

			if (selectedMode === 'true' || selectedMode === '')
			{
				const currentMode = Number.isInteger(this.acState.ac_mode) ? this.acState.ac_mode : -1;
				const nextMode = (currentMode + 1) % modes.length;
				selectedMode = modes[nextMode];
			}

			if (!modes.includes(selectedMode))
			{
				throw new Error(`Unsupported AC mode ${selectedMode}`);
			}

			const modeMap = { auto: 0, cool: 1, dry: 2, fan_only: 3, heat: 4 };
			const modeValue = modeMap[selectedMode];
			if (!Number.isInteger(modeValue))
			{
				throw new Error(`No AC mode mapping for ${selectedMode}`);
			}

			this.acState.ac_mode = modeValue;
			this.acState.pwr = 1;
			return {
				topic: config.mode_command_topic || config.command_topic,
				payload: JSON.stringify({ ac_mode: modeValue, pwr: 1 }),
			};
		}

		if (capability === 'ac_fan')
		{
			const fanModes = this.getFanModes(config);
			let selectedFanMode = String(value || '').trim();

			if (selectedFanMode === 'true' || selectedFanMode === '')
			{
				const currentFan = Number.isInteger(this.acState.ac_mark) ? this.acState.ac_mark : -1;
				const nextFan = (currentFan + 1) % fanModes.length;
				selectedFanMode = fanModes[nextFan];
			}

			const fanIndex = fanModes.indexOf(selectedFanMode);
			if (fanIndex < 0)
			{
				throw new Error(`Unsupported AC fan mode ${selectedFanMode}`);
			}

			this.acState.ac_mark = fanIndex;
			return {
				topic: config.fan_mode_command_topic || config.command_topic,
				payload: JSON.stringify({ ac_mark: fanIndex }),
			};
		}

		throw new Error(`Unsupported capability ${capability}`);
	}

	async processMQTTMessage(mqttMessage, value, rawPayload, jsonPayload)
	{
		if (mqttMessage.deviceId !== this.getData().id)
		{
			return false;
		}

		this.homey.app.updateLog(`MQTT message received for ${this.getName()}: ${mqttMessage.name} => ${value}`);

		if (mqttMessage.component !== 'climate')
		{
			return false;
		}

		let payload = jsonPayload;
		if (!payload && typeof rawPayload === 'string' && rawPayload.trim().startsWith('{'))
		{
			try
			{
				payload = JSON.parse(rawPayload);
			}
			catch (err)
			{
				payload = null;
			}
		}

		if (!payload || typeof payload !== 'object')
		{
			return true;
		}

		if (Number.isFinite(Number(payload.pwr))) this.acState.pwr = Number(payload.pwr);
		if (Number.isFinite(Number(payload.temp))) this.acState.temp = Number(payload.temp);
		if (Number.isFinite(Number(payload.envtemp))) this.acState.envtemp = Number(payload.envtemp);
		if (Number.isFinite(Number(payload.ac_mode))) this.acState.ac_mode = Number(payload.ac_mode);
		if (Number.isFinite(Number(payload.ac_mark))) this.acState.ac_mark = Number(payload.ac_mark);

		if (this.hasCapability('target_temperature') && Number.isFinite(this.acState.temp))
		{
			if (this.getCapabilityValue('target_temperature') !== this.acState.temp)
			{
				await this.setCapabilityValue('target_temperature', this.acState.temp);
			}
		}

		if (this.hasCapability('onoff') && Number.isInteger(this.acState.pwr))
		{
			const isOn = this.acState.pwr === 1;
			if (this.getCapabilityValue('onoff') !== isOn)
			{
				await this.setCapabilityValue('onoff', isOn);
			}
		}

		if (this.hasCapability('ac_mode'))
		{
			const modeIndexToName = { 0: 'auto', 1: 'cool', 2: 'dry', 3: 'fan_only', 4: 'heat' };
			const mode = modeIndexToName[this.acState.ac_mode];
			if (mode && this.getCapabilityValue('ac_mode') !== mode)
			{
				await this.setCapabilityValue('ac_mode', mode);
			}
		}

		if (this.hasCapability('ac_fan'))
		{
			const fanModes = this.getFanModes(mqttMessage.rawConfig || {});
			const fanMode = Number.isInteger(this.acState.ac_mark) && fanModes[this.acState.ac_mark]
				? fanModes[this.acState.ac_mark]
				: fanModes[0];

			if (fanMode && this.getCapabilityValue('ac_fan') !== fanMode)
			{
				await this.setCapabilityValue('ac_fan', fanMode);
			}
		}

		return true;
	}

	async processEntityAvailability(mqttMessage)
	{
		return syncCapabilitiesByEntityMatcher(
			this,
			mqttMessage,
			CAPABILITIES,
			(entity) => entity.component === 'climate' || CLIMATE_ENTITY_NAMES.includes(entity.name),
		);
	}
};
