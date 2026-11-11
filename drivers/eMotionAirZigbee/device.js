'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');
const AirOnOffBoundCluster = require('./AirOnOffBoundCluster');
const AirLevelControlBoundCluster = require('./AirLevelControlBoundCluster');
const AirButtonBoundCluster = require('./AirButtonBoundCluster');
const LinknLinkAirConfigCluster = require('./LinknLinkAirConfigCluster');
const LinknLinkButtonActionCluster = require('./LinknLinkButtonActionCluster');

const REPORTING_SETTING_KEYS = [
	'temperature_min_change',
	'humidity_min_change',
];

// Device configuration parameters (firmware >= 1.2.8), sent via the
// manufacturer-specific air configuration cluster (0xFC00)
const AIR_CONFIG_MASK = {
	freq: 1 << 0,
	trith: 1 << 1,
	absence_timeout: 1 << 2,
	radar_enable: 1 << 3,
	lx_interval: 1 << 4,
	sht_interval: 1 << 5,
	lx_thread1: 1 << 6,
	lx_thread2: 1 << 7,
};

const AIR_CONFIG_SETTING_KEYS = Object.keys(AIR_CONFIG_MASK);

// Button actions reported via the manufacturer-specific button cluster (0xFC01)
const BUTTON_ACTION_BY_ID = {
	1: 'single',
	2: 'double',
	3: 'triple',
	4: 'hold',
};

const BUTTON_ACTION_EVENTS = {
	single: 'Press',
	double: 'Double Press',
	triple: 'Triple Press',
	hold: 'Long Press',
	release: 'Release',
};

function parseOccupancy(value)
{
	if (value && typeof value.getBit === 'function')
	{
		return value.getBit(0);
	}
	if (Array.isArray(value))
	{
		return value.includes('occupied');
	}
	return value === true || (Number(value) & 1) === 1;
}

const ATTRIBUTE_REPORTING_CONFIG = [
	{
		cluster: CLUSTER.OCCUPANCY_SENSING,
		attributeName: 'occupancy',
		minInterval: 0,
		maxInterval: 3600,
		minChange: 0,
	},
	{
		cluster: CLUSTER.TEMPERATURE_MEASUREMENT,
		attributeName: 'measuredValue',
		minInterval: 10,
		maxInterval: 3600,
		minChange: 100,
	},
	{
		cluster: CLUSTER.RELATIVE_HUMIDITY_MEASUREMENT,
		attributeName: 'measuredValue',
		minInterval: 10,
		maxInterval: 3600,
		minChange: 100,
	},
	{
		cluster: CLUSTER.ILLUMINANCE_MEASUREMENT,
		attributeName: 'measuredValue',
		minInterval: 10,
		maxInterval: 3600,
		minChange: 5,
	},
	{
		cluster: CLUSTER.POWER_CONFIGURATION,
		attributeName: 'batteryPercentageRemaining',
		minInterval: 3600,
		maxInterval: 65000,
		minChange: 10,
	},
];

module.exports = class eMotionAirZigbeeDevice extends ZigBeeDevice
{
	async onNodeInit({ zclNode })
	{
		this.registerCapability('alarm_presence', CLUSTER.OCCUPANCY_SENSING, {
			get: 'occupancy',
			report: 'occupancy',
			reportParser: parseOccupancy,
			getOpts: {
				getOnOnline: true,
			},
		});
		this.registerCapability('measure_temperature', CLUSTER.TEMPERATURE_MEASUREMENT);
		this.registerCapability('measure_humidity', CLUSTER.RELATIVE_HUMIDITY_MEASUREMENT);
		this.registerCapability('measure_luminance', CLUSTER.ILLUMINANCE_MEASUREMENT);
		this.registerCapability('measure_battery', CLUSTER.POWER_CONFIGURATION);

		this.bindOutputCluster(zclNode, CLUSTER.ON_OFF, new AirOnOffBoundCluster(this.handleButtonEvent.bind(this)));
		this.bindOutputCluster(zclNode, CLUSTER.LEVEL_CONTROL, new AirLevelControlBoundCluster(this.handleButtonEvent.bind(this)));
		this.setupAirConfigCluster(zclNode);
		this.setupButtonActionCluster(zclNode);
		this.registerPresenceListener(zclNode);
		this.registerPresenceRefreshOnSensorReports(zclNode);
		this.configureSensorReporting();
		this.syncFirmwareVersion('initialization');
		this.flushAirConfig('initialization');
		this.refreshPresence('initialization');

		this.log('eMotion Air Zigbee device initialized');
	}

	async onSettings({ newSettings, changedKeys })
	{
		const reportingKeys = changedKeys.filter((key) => REPORTING_SETTING_KEYS.includes(key));
		const airConfigKeys = changedKeys.filter((key) => AIR_CONFIG_SETTING_KEYS.includes(key));

		for (const key of reportingKeys)
		{
			if (!Number.isFinite(newSettings[key]) || newSettings[key] < 0.1)
			{
				throw new Error('Minimum change before reporting must be at least 0.1');
			}
		}

		if (airConfigKeys.includes('lx_thread1') || airConfigKeys.includes('lx_thread2'))
		{
			if (Number(newSettings.lx_thread2) <= Number(newSettings.lx_thread1))
			{
				throw new Error('The normal/bright illuminance threshold must be higher than the dark/normal threshold');
			}
		}

		if (reportingKeys.length > 0)
		{
			this.sensorReportingConfigured = false;
			this.configureSensorReporting(newSettings);
		}

		if (airConfigKeys.length > 0)
		{
			let mask = airConfigKeys.reduce((bits, key) => bits | AIR_CONFIG_MASK[key], 0);

			// The firmware validates the threshold pair together, so always send both
			if (mask & (AIR_CONFIG_MASK.lx_thread1 | AIR_CONFIG_MASK.lx_thread2))
			{
				mask |= AIR_CONFIG_MASK.lx_thread1 | AIR_CONFIG_MASK.lx_thread2;
			}

			this.setPendingAirConfigMask(this.getPendingAirConfigMask() | mask);
			this.flushAirConfig('settings change', newSettings);

			return 'The eMotion Air is a battery powered device. Short-press its button once to wake it so the new configuration can be applied.';
		}

		return undefined;
	}

	getAttributeReportingConfig(settings = this.getSettings())
	{
		return ATTRIBUTE_REPORTING_CONFIG.map((config) =>
		{
			if (config.cluster === CLUSTER.TEMPERATURE_MEASUREMENT)
			{
				return { ...config, minChange: Math.round((settings.temperature_min_change ?? 1) * 100) };
			}
			if (config.cluster === CLUSTER.RELATIVE_HUMIDITY_MEASUREMENT)
			{
				return { ...config, minChange: Math.round((settings.humidity_min_change ?? 1) * 100) };
			}
			return config;
		});
	}

	configureSensorReporting(settings)
	{
		if (this.sensorReportingConfigured || this.sensorReportingConfigurationPending)
		{
			return;
		}

		this.sensorReportingConfigurationPending = true;
		const configure = () => this.configureAttributeReporting(this.getAttributeReportingConfig(settings));
		configure()
			.then(() =>
			{
				this.sensorReportingConfigured = true;
				this.sensorReportingConfigurationPending = false;
				this.sensorReportingRetryScheduled = false;
				this.log('eMotion Air Zigbee sensor reporting configured');
				this.refreshPresence('reporting configuration');
			})
			.catch((err) =>
			{
				this.sensorReportingConfigurationPending = false;
				this.error('Unable to configure eMotion Air Zigbee sensor reporting; retrying when the device wakes', err);
				if (!this.sensorReportingRetryScheduled)
				{
					this.sensorReportingRetryScheduled = true;
					this.scheduleForNextEndDeviceAnnounce(configure)
						.then(() =>
						{
							this.sensorReportingConfigured = true;
							this.sensorReportingRetryScheduled = false;
							this.log('eMotion Air Zigbee sensor reporting configured after device wake');
							this.refreshPresence('reporting retry');
						})
						.catch((retryErr) =>
						{
							this.sensorReportingRetryScheduled = false;
							this.error('Unable to configure eMotion Air Zigbee sensor reporting after device wake', retryErr);
						});
				}
			});
	}

	registerPresenceListener(zclNode)
	{
		const endpointId = this.getClusterEndpoint(CLUSTER.OCCUPANCY_SENSING);
		const occupancyCluster = zclNode.endpoints[endpointId]?.clusters[CLUSTER.OCCUPANCY_SENSING.NAME];
		if (!occupancyCluster)
		{
			this.error('eMotion Air Zigbee occupancy cluster was not found');
			return;
		}

		occupancyCluster.on('attr.occupancy', (value) =>
		{
			const occupied = parseOccupancy(value);
			this.log(`eMotion Air Zigbee occupancy report: ${occupied}`);
			this.setCapabilityValue('alarm_presence', occupied).catch(this.error);
			this.flushAirConfig('occupancy report');
		});
	}

	registerPresenceRefreshOnSensorReports(zclNode)
	{
		const sensorReports = [
			[CLUSTER.TEMPERATURE_MEASUREMENT, 'measuredValue'],
			[CLUSTER.RELATIVE_HUMIDITY_MEASUREMENT, 'measuredValue'],
			[CLUSTER.ILLUMINANCE_MEASUREMENT, 'measuredValue'],
			[CLUSTER.POWER_CONFIGURATION, 'batteryPercentageRemaining'],
		];

		for (const [cluster, attributeName] of sensorReports)
		{
			const endpointId = this.getClusterEndpoint(cluster);
			const sensorCluster = zclNode.endpoints[endpointId]?.clusters[cluster.NAME];
			if (sensorCluster)
			{
				sensorCluster.on(`attr.${attributeName}`, () =>
				{
					this.refreshPresence(`${cluster.NAME} report`);
					this.syncFirmwareVersion(`${cluster.NAME} report`);
					this.flushAirConfig(`${cluster.NAME} report`);
				});
			}
		}
	}

	refreshPresence(reason)
	{
		if (this.presenceRefreshPending)
		{
			return;
		}

		this.presenceRefreshPending = true;
		this.getClusterCapabilityValue('alarm_presence', CLUSTER.OCCUPANCY_SENSING)
			.then((occupied) => this.log(`eMotion Air Zigbee presence refreshed after ${reason}: ${occupied}`))
			.catch((err) => this.log(`eMotion Air Zigbee presence refresh deferred after ${reason}: ${err.message}`))
			.finally(() =>
			{
				this.presenceRefreshPending = false;
			});
	}

	bindOutputCluster(zclNode, cluster, boundCluster)
	{
		const endpoint = Object.values(zclNode.endpoints)
			.find((candidate) => candidate._descriptor?.outputClusters?.includes(cluster.ID));
		if (!endpoint)
		{
			this.log(`eMotion Air Zigbee output cluster ${cluster.NAME} was not found`);
			return;
		}

		endpoint.bind(cluster.NAME, boundCluster);
	}

	handleButtonEvent(eventType, command)
	{
		this.log(`eMotion Air Zigbee button command ${command} mapped to ${eventType}`);
		this.configureSensorReporting();
		this.syncFirmwareVersion('button wake', { refresh: true });
		this.flushAirConfig('button wake');
		this.refreshPresence('button wake');
		this.homey.app.triggerEMotionAirButtonEvent(this, eventType);
	}

	syncFirmwareVersion(reason, { refresh = false } = {})
	{
		if (this.firmwareVersionSyncInFlight)
		{
			return;
		}

		// Refresh from the device at most once per session; otherwise only fetch
		// when the setting is still empty (the cached value is used if available)
		if (refresh ? this.firmwareVersionRefreshed : !!this.getSetting('firmware_version'))
		{
			return;
		}

		this.firmwareVersionSyncInFlight = true;
		this.getSwBuildId({ skipCache: refresh })
			.then((swBuildId) =>
			{
				if (refresh)
				{
					this.firmwareVersionRefreshed = true;
				}
				this.log(`eMotion Air Zigbee firmware version ${swBuildId} retrieved after ${reason}`);
				return this.setSettings({ firmware_version: swBuildId });
			})
			.catch((err) =>
			{
				this.log(`eMotion Air Zigbee firmware version read deferred after ${reason}: ${err.message}`);
			})
			.finally(() =>
			{
				this.firmwareVersionSyncInFlight = false;
			});
	}

	setupAirConfigCluster(zclNode)
	{
		const endpoint = zclNode.endpoints[1];
		if (!endpoint)
		{
			this.error('eMotion Air Zigbee endpoint 1 was not found');
			return;
		}

		// The device does not advertise the manufacturer-specific cluster in its
		// descriptor, so create the cluster instance manually when needed
		if (!endpoint.clusters[LinknLinkAirConfigCluster.NAME])
		{
			endpoint.clusters[LinknLinkAirConfigCluster.NAME] = new LinknLinkAirConfigCluster(endpoint);
		}

		this.airConfigCluster = endpoint.clusters[LinknLinkAirConfigCluster.NAME];
		this.airConfigCluster.on('configStatus', (payload) => this.onAirConfigReport('configuration update', payload));
		this.airConfigCluster.on('getConfigRsp', (payload) => this.onAirConfigReport('configuration request', payload));
	}

	setupButtonActionCluster(zclNode)
	{
		const endpoint = zclNode.endpoints[1];
		if (!endpoint)
		{
			return;
		}

		// Firmware >= 1.2.7 reports button presses via the manufacturer-specific
		// button cluster. Handle both frame directions to be safe.
		endpoint.bind(LinknLinkButtonActionCluster.NAME, new AirButtonBoundCluster(this.handleButtonActionCommand.bind(this)));

		if (!endpoint.clusters[LinknLinkButtonActionCluster.NAME])
		{
			endpoint.clusters[LinknLinkButtonActionCluster.NAME] = new LinknLinkButtonActionCluster(endpoint);
		}
		endpoint.clusters[LinknLinkButtonActionCluster.NAME].on('buttonAction', ({ actionId, actionStr } = {}) => this.handleButtonActionCommand(actionId, actionStr));
	}

	handleButtonActionCommand(actionId, actionStr)
	{
		const action = BUTTON_ACTION_BY_ID[actionId]
			|| ((typeof actionStr === 'string' && BUTTON_ACTION_EVENTS[actionStr]) ? actionStr : undefined);
		if (!action)
		{
			this.log(`eMotion Air Zigbee unknown button action: id=${actionId} str=${actionStr}`);
			return;
		}

		this.handleButtonEvent(BUTTON_ACTION_EVENTS[action], `button_${action}`);
	}

	getPendingAirConfigMask()
	{
		if (this.pendingAirConfigMask === undefined)
		{
			this.pendingAirConfigMask = this.getStoreValue('pendingAirConfigMask') || 0;
		}
		return this.pendingAirConfigMask;
	}

	setPendingAirConfigMask(mask)
	{
		this.pendingAirConfigMask = mask;
		this.setStoreValue('pendingAirConfigMask', mask).catch(this.error);
	}

	buildAirConfigPayload(settings, mask)
	{
		const clamp = (value, min, max, fallback) =>
		{
			const number = Number(value);
			if (!Number.isFinite(number))
			{
				return fallback;
			}
			return Math.max(min, Math.min(max, Math.round(number)));
		};

		return {
			formatVersion: 1,
			mask,
			freq: clamp(settings.freq, 0, 4, 0),
			trith: clamp(settings.trith, 1, 10, 3),
			absenceTimeout: Math.round(clamp(settings.absence_timeout, 0, 510, 180) / 2) * 2,
			radarEnable: settings.radar_enable === false ? 0 : 1,
			lxInterval: clamp(settings.lx_interval, 2, 60000, 30),
			shtInterval: clamp(settings.sht_interval, 10, 60000, 60),
			lxThread1: clamp(settings.lx_thread1, 0, 65535, 0),
			lxThread2: clamp(settings.lx_thread2, 0, 65535, 1),
		};
	}

	flushAirConfig(reason, settings)
	{
		if (!this.airConfigCluster || this.airConfigSendInFlight)
		{
			return;
		}

		const pendingMask = this.getPendingAirConfigMask();
		if (!pendingMask && this.airConfigSynced)
		{
			return;
		}

		this.airConfigSendInFlight = true;
		const options = { waitForResponse: false, disableDefaultResponse: true };
		const send = pendingMask
			? this.airConfigCluster.setConfig(this.buildAirConfigPayload(settings || this.getSettings(), pendingMask), options)
			: this.airConfigCluster.getConfig({}, options);

		send
			.then(() =>
			{
				this.log(`eMotion Air Zigbee configuration ${pendingMask ? `update (mask 0x${pendingMask.toString(16)})` : 'request'} sent after ${reason}`);
			})
			.catch((err) =>
			{
				this.log(`eMotion Air Zigbee configuration ${pendingMask ? 'update' : 'request'} deferred after ${reason}: ${err.message}`);
			})
			.finally(() =>
			{
				this.airConfigSendInFlight = false;
			});
	}

	onAirConfigReport(reason, payload = {})
	{
		this.airConfigSynced = true;

		if (payload.status !== undefined && payload.status !== 0)
		{
			this.error(`eMotion Air Zigbee ${reason} was rejected with status ${payload.status}`);
		}

		// The device reports its actual configuration, so clear any pending update
		this.setPendingAirConfigMask(0);

		const settings = {};
		if (payload.freq !== undefined)
		{
			settings.freq = String(payload.freq);
		}
		if (payload.trith !== undefined)
		{
			settings.trith = payload.trith;
		}
		if (payload.absenceTimeout !== undefined)
		{
			settings.absence_timeout = payload.absenceTimeout;
		}
		if (payload.radarEnable !== undefined)
		{
			settings.radar_enable = payload.radarEnable === 1 || payload.radarEnable === true;
		}
		if (payload.lxInterval !== undefined)
		{
			settings.lx_interval = payload.lxInterval;
		}
		if (payload.shtInterval !== undefined)
		{
			settings.sht_interval = payload.shtInterval;
		}
		if (payload.lxThread1 !== undefined)
		{
			settings.lx_thread1 = payload.lxThread1;
		}
		if (payload.lxThread2 !== undefined)
		{
			settings.lx_thread2 = payload.lxThread2;
		}

		this.log(`eMotion Air Zigbee configuration received after ${reason}:`, settings);

		if (Object.keys(settings).length > 0)
		{
			this.setSettings(settings).catch(this.error);
		}
	}
};
