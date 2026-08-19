'use strict';

const { ZigBeeDevice } = require('homey-zigbeedriver');
const { CLUSTER } = require('zigbee-clusters');
const AirOnOffBoundCluster = require('./AirOnOffBoundCluster');
const AirLevelControlBoundCluster = require('./AirLevelControlBoundCluster');

const REPORTING_SETTING_KEYS = [
	'temperature_min_change',
	'humidity_min_change',
];

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
		this.registerPresenceListener(zclNode);
		this.registerPresenceRefreshOnSensorReports(zclNode);
		this.configureSensorReporting();
		this.refreshPresence('initialization');

		this.log('eMotion Air Zigbee device initialized');
	}

	async onSettings({ newSettings, changedKeys })
	{
		if (!changedKeys.some((key) => REPORTING_SETTING_KEYS.includes(key)))
		{
			return;
		}

		for (const key of changedKeys.filter((changedKey) => REPORTING_SETTING_KEYS.includes(changedKey)))
		{
			if (!Number.isFinite(newSettings[key]) || newSettings[key] < 0.1)
			{
				throw new Error('Minimum change before reporting must be at least 0.1');
			}
		}

		this.sensorReportingConfigured = false;
		this.configureSensorReporting(newSettings);
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
				sensorCluster.on(`attr.${attributeName}`, () => this.refreshPresence(`${cluster.NAME} report`));
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
		this.refreshPresence('button wake');
		this.homey.app.triggerEMotionAirButtonEvent(this, eventType);
	}
};
