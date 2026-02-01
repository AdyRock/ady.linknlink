/* eslint-disable operator-linebreak */
/* eslint-disable no-tabs */

'use strict';

/** *******************************************************************************
** YoLink API interface ***
** See http://doc.yosmart.com/docs/protocol/openAPIV2/en.html for details  **
******************************************************************************** */
const
	{
		SimpleClass,
	} = require('homey');

const net = require('./net');
const ws = require('websocket-stream');
const httpServer = require('http').createServer();
const aedes = require('./aedes')();
const mqtt = require('./mqtt');

const desiredComponents = [
	'temperature',
	'humidity',
	'brightness',
	'Any Presence',
	'Zone 1 Presence',
	'Zone 2 Presence',
	'Zone 3 Presence',
	'Zone 4 Presence',
	'Persons in Fenced Zones',
	'All Target Counts',
	'Zone 1 Target Counts',
	'Zone 2 Target Counts',
	'Zone 3 Target Counts',
	'Zone 4 Target Counts',
	'wifi rssi',
	'all_area',
	'area_1',
	'area_2',
	'area_3',
	'area_4',
];

const DISCOVERY_PREFIX = 'homeassistant'; // default HA discovery prefix

module.exports = class LinknLink extends SimpleClass
{
	constructor(app)
	{
		super();
		this.app = app;
		let settingsChanged = false;
		this.broker = this.app.homey.settings.get('brokerSettings') || {};
		if (this.broker.useHomeyBroker === undefined)
		{
			this.broker.useHomeyBroker = true;
			settingsChanged = true;
		}

		if (this.broker.username === undefined)
		{
			this.broker.username = 'linknlinkuser';
			settingsChanged = true;
		}
		if (this.broker.password === undefined)
		{
			this.broker.password = 'linknlinkpassword';
			settingsChanged = true;
		}
		if (!this.broker.port)
		{
			this.broker.port = 10883;
			settingsChanged = true;
		}
		if (this.broker.wsport === undefined)
		{
			this.broker.wsport = 18888;
			settingsChanged = true;
		}
		if (this.broker.url === undefined)
		{
			this.broker.url = 'mqtt://localhost';
			settingsChanged = true;
		}
		if (this.broker.brokerid === undefined)
		{
			this.broker.brokerid = 'LinknLinkLocalBroker';
			settingsChanged = true;
		}

		if (settingsChanged)
		{
			this.app.homey.settings.set('brokerSettings', this.broker);
		}

		this.mqttServerReady = false;
		this.MQTTclient = null;

		// key: `${component}:${unique_id || node_id}/${object_id}`
		this.entities = new Map();

		// key: device identifier string e.g. "did_e04b..."
		this.devices = new Map();

		// topics -> entityKey
		this.stateTopicToEntityKey = new Map();
		this.availTopicToEntityKey = new Map();
		this.pendingMessages = new Map();
	}

	setupHomeyMQTTServer()
	{
		if (!this.broker.useHomeyBroker)
		{
			// Start the MQTT client
			this.setupMQTTClient(this.broker, this.app.homeyID);
			return;
		}

		// Setup the local MQTT server
		aedes.authenticate = function aedesAuthenticate(client, username, password, callback)
		{
			password = password ? Buffer.from(password, 'base64').toString() : '';
			if ((!username || username === this.broker.username) && (password === this.broker.password))
			{
				callback(null, true);
			}
			else
			{
				callback(new Error('Authentication Failed'), false);
			}
			// callback(null, true);
		}.bind(this);

		this.server = net.createServer(aedes.handle);
		try
		{
			this.server.listen(this.broker.port, () =>
			{
				this.app.updateLog(`server started and listening on port ${this.broker.port}`);
				this.mqttServerReady = true;

				// Start the MQTT client
				this.setupMQTTClient(this.broker, this.app.homeyID);
			});
		}
		catch (err)
		{
			if (err.code === 'ERR_SERVER_ALREADY_LISTEN')
			{
				this.app.updateLog(`server already listening on port ${this.broker.port}`);
			}
			else if (err.code === 'EADDRINUSE')
			{
				this.app.updateLog(`server address in use on port ${this.broker.port}`);
			}
		}

		this.server.on('error', (err) =>
		{
			this.app.updateLog(`server error: ${this.varToString(err)}`, 0);
		});

		// Create a websocket server for the MQTT server
		this.wsServer = ws.createServer({ server: httpServer }, aedes.handle);

		try
		{
			httpServer.listen(this.broker.wsport, () =>
			{
				this.app.updateLog(`websocket server listening on port ${this.broker.wsport}`);
			});
		}
		catch (err)
		{
			if (err.code === 'ERR_SERVER_ALREADY_LISTEN')
			{
				this.app.updateLog(`server already listening on port ${this.broker.wsport}`);
			}
			else if (err.code === 'EADDRINUSE')
			{
				this.app.updateLog(`server address in use on port ${this.broker.wsport}`);
			}
		}

		this.wsServer.on('error', (err) =>
		{
			this.app.updateLog(`websocket server error: ${this.varToString(err)}`, 0);
		});

		this.wsServer.on('connection', (socket) =>
		{
			this.app.updateLog('websocket server connection');
		});

		this.wsServer.on('message', (message) =>
		{
			this.app.updateLog(`websocket server message: ${this.varToString(message)}`);
		});
	}

	setupMQTTClient(brokerConfig, homeyID)
	{
		try
		{
			// Connect to the MQTT server and subscribe to the required topics
			// this.MQTTclient = mqtt.connect(MQTT_SERVER, { clientId: `HomeyLinknLinkApp-${homeyID}`, username: Homey.env.MQTT_USER_NAME, password: Homey.env.MQTT_PASSWORD });
			this.app.updateLog(`setupMQTTClient connect: ${brokerConfig.url}:${brokerConfig.port}`, 1);
			this.MQTTclient = mqtt.connect(`${brokerConfig.url}:${brokerConfig.port}`, { clientId: `HomeyLinknLinkApp-${homeyID}`, username: brokerConfig.username, password: brokerConfig.password });

			this.MQTTclient.on('connect', () =>
			{
				this.app.updateLog(`setupMQTTClient.onConnect: connected to ${brokerConfig.url}:${brokerConfig.port} as ${brokerConfig.brokerid}`);

				// Subscribe to HA discovery
				this.MQTTclient.subscribe(`${DISCOVERY_PREFIX}/#`, { qos: 0 }, (err) =>
				{
					if (err)
					{
						this.app.updateLog(`subscribe discovery error: ${this.varToString(err)}`);
					}
					else
					{
						this.app.updateLog('subscribed to discovery');
					}
				});
			});

			this.MQTTclient.on('error', (err) =>
			{
				this.app.updateLog(`setupMQTTClient.onError: ${this.app.varToString(err)}`, 0);
			});

			this.MQTTclient.on('message', async (topic, payloadBuf) =>
			{
				const payloadStr = payloadBuf.toString('utf8').trim();

				// Discovery configs always end with /config
				if (topic.startsWith(`${DISCOVERY_PREFIX}/`) && topic.endsWith('/config'))
				{
					this.handleDiscoveryConfig(topic, payloadStr);
					return;
				}

				// State updates
				const entKeyFromState = this.stateTopicToEntityKey.get(topic);
				if (entKeyFromState)
				{
					this.handleEntityState(entKeyFromState, payloadStr);
					return;
				}

				// Availability updates
				const entKeyFromAvail = this.availTopicToEntityKey.get(topic);
				if (entKeyFromAvail)
				{
					this.handleEntityAvailability(entKeyFromAvail, payloadStr);
				}
			});

			return true;
		}
		catch (err)
		{
			this.app.updateLog(`setupMQTTClient error: ${err.message}`, 0);
			return false;
		}
	}

	disconnectAllClientsAndClose()
	{
		// Iterate through all connected clients and disconnect them
		aedes.close(() =>
		{
			// server.close();
			// wsServer.close();
			// httpServer.close();
		});

		this.server = null;
		this.wsServer = null;
	}

	// eslint-disable-next-line camelcase
	async publishMQTTMessage(topic, message, Ignoresame = true, Retain = true)
	{
		if (message === undefined)
		{
			message = ' ';
		}

		let data = (typeof message === 'string' || message instanceof String) ? message : JSON.stringify(message);
		if (data === '')
		{
			data = ' ';
		}

		this.app.updateLog(`publishMQTTMessage: ${data} to topic ${topic}`);
		try
		{
			await this.MQTTclient.publish(topic, data, { qos: 1, retain: Retain });
		}
		catch (err)
		{
			this.app.updateLog(`publishMQTTMessage error: ${err.message}`, 0);
		}
	}

	async UnsubscribeMQTTMessage(topic)
	{

		this.app.updateLog(`UnsubscribeMQTTMessage: ${topic}`);
		try
		{
			await this.MQTTclient.unsubscribe(topic);
		}
		catch (err)
		{
			this.app.updateLog(`UnsubscribeMQTTMessage error: ${err.message}`, 0);
		}
	}

	// -------------------- Discovery --------------------

	handleDiscoveryConfig(topic, payloadStr)
	{
		// HA sends empty payload to remove entity
		if (!payloadStr)
		{
			this.removeEntityByConfigTopic(topic);
			return;
		}

		let config;
		try
		{
			config = JSON.parse(payloadStr);
		}
		catch (e)
		{
			this.app.updateLog(`Bad JSON in config topic ${topic}: ${e.message}`, 0);
			return;
		}

		if (config === null || typeof config !== 'object')
		{
			this.app.updateLog(`Invalid config in topic ${topic}`, 0);
			return;
		}

		// Check if this config is of interest by looking to see if the name is in the desired array
		if (!desiredComponents.includes(config.name))
		{
			this.app.updateLog(`Ignoring component ${config.name}`, 0);
			return;
		}

		const parsed = this.parseDiscoveryTopic(topic);
		if (!parsed) return;

		const { component, nodeId, objectId } = parsed;

		// Build a stable key for this entity
		const uniqueId = config.unique_id || `${nodeId}/${objectId}`;
		const entityKey = `${component}:${uniqueId}`;

		// Group under a physical device if possible
		const deviceId =
			config?.device?.identifiers?.[0] ||
			config?.device?.identifiers?.join('|') ||
			null;

		if (deviceId)
		{
			if (!this.devices.has(deviceId))
			{
				this.devices.set(deviceId, {
					deviceId,
					name: config?.device?.name,
					model: config?.device?.model,
					manufacturer: config?.device?.manufacturer,
					entities: new Set(),
				});
				this.app.updateLog(`Discovered device: ${JSON.stringify(this.devices.get(deviceId))}`, 0);
				// In a Homey app, this is where you'd create/register the physical device.
			}
			this.devices.get(deviceId).entities.add(entityKey);
		}

		// Store entity config
		this.entities.set(entityKey, {
			entityKey,
			configTopic: topic,
			component,
			nodeId,
			objectId,
			deviceId,
			name: config.name,
			deviceClass: config.device_class,
			stateTopic: config.state_topic,
			availabilityTopic: config.availability_topic,
			valueTemplate: config.value_template,
			payloadOn: config.payload_on,
			payloadOff: config.payload_off,
			unit: config.unit_of_measurement,
			rawConfig: config,
		});

		// Subscribe to its topics
		if (config.state_topic)
		{
			this.stateTopicToEntityKey.set(config.state_topic, entityKey);
			this.MQTTclient.subscribe(config.state_topic);
		}

		if (config.availability_topic)
		{
			this.availTopicToEntityKey.set(config.availability_topic, entityKey);
			this.MQTTclient.subscribe(config.availability_topic);
		}

		this.app.updateLog(`Discovered entity: ${entityKey}, ${this.app.varToString(this.entities.get(entityKey))}`, 0);

		// In a Homey app, this is where you'd create/register a capability mapping
		// e.g. binary_sensor motion -> alarm_motion, sensor temperature -> measure_temperature.
	}

	parseDiscoveryTopic(topic)
	{
		// Expected: homeassistant/<component>/<node_id>/<object_id>/config
		const parts = topic.split('/');
		if (parts.length < 5) return null;
		const [prefix, component, nodeId, objectId, last] = parts;
		if (prefix !== DISCOVERY_PREFIX || last !== 'config') return null;
		return { component, nodeId, objectId };
	}

	removeEntityByConfigTopic(configTopic)
	{
		// Entity removed by HA; delete if we find it
		for (const [key, ent] of this.entities.entries())
		{
			if (ent.configTopic === configTopic)
			{
				this.entities.delete(key);
				if (ent.stateTopic) this.stateTopicToEntityKey.delete(ent.stateTopic);
				if (ent.availabilityTopic) this.availTopicToEntityKey.delete(ent.availabilityTopic);
				this.app.updateLog(`Entity removed: ${key}`);
				break;
			}
		}
	}

	// -------------------- State handling --------------------

	handleEntityAvailability(entityKey, payloadStr)
	{
		const ent = this.entities.get(entityKey);
		if (!ent) return;

		// LinknLink often uses "online"/"offline" or 1/0 — depends on firmware.
		const v = payloadStr.replace(/"/g, '').toLowerCase();
		const isOnline = v === 'online' || v === '1' || v === 'true';

		//		this.app.updateLog(`[avail] ${entityKey} => ${isOnline ? 'online' : 'offline'}`);

		// Homey: you might call device.setAvailable()/setUnavailable() here.
	}

	handleEntityState(entityKey, payloadStr)
	{
		const ent = this.entities.get(entityKey);
		if (!ent) return;

		// Many HA MQTT entities use JSON payloads; yours do.
		let json = null;
		if (payloadStr.startsWith('{') || payloadStr.startsWith('['))
		{
			try
			{
				json = JSON.parse(payloadStr);
			}
			catch
			{
				// ignore JSON parse errors
			}
		}

		const value = this.applyValueTemplate(ent.valueTemplate, payloadStr, json);

		// If it's a binary_sensor using payload_on/off, normalize to boolean
		let normalized = value;
		if (ent.component === 'binary_sensor')
		{
			if (ent.payloadOn !== undefined && ent.payloadOff !== undefined)
			{
				// eslint-disable-next-line no-nested-ternary
				normalized = this.looselyEqual(value, ent.payloadOn) ? true : this.looselyEqual(value, ent.payloadOff) ? false : Boolean(value);
			}
			else
			{
				normalized = Boolean(value);
			}
		}

		// Find the device this entity belongs to
		const device = this.app.getDeviceByDid(ent.deviceId);
		if (!device)
		{
			// Queue messages until device is available?
			this.pendingMessages.set(entityKey, payloadStr);

			this.log(`No device found for ${ent.deviceId}, caching message`);
			return;
		}

		// Map entity to capability and update value
		device.processMQTTMessage(ent, normalized);
	}

	flushPendingMessagesForDevice(deviceId)
	{
		for (const [entityKey, payloadStr] of this.pendingMessages.entries())
		{
			const ent = this.entities.get(entityKey);
			if (ent && ent.deviceId === deviceId)
			{
				this.handleEntityState(entityKey, payloadStr);
				this.pendingMessages.delete(entityKey);
			}
		}
	}

	removePendingMessagesForDevice(deviceId)
	{
		for (const [entityKey] of this.pendingMessages.entries())
		{
			const ent = this.entities.get(entityKey);
			if (ent && ent.deviceId === deviceId)
			{
				this.pendingMessages.delete(entityKey);
			}
		}
	}

	looselyEqual(a, b)
	{
		// handle 1 vs "1" vs true, etc
		if (a === b) return true;
		if (Number.isFinite(Number(a)) && Number.isFinite(Number(b)))
		{
			return Number(a) === Number(b);
		}
		return String(a) === String(b);
	}

	// -------------------- Minimal template support --------------------

	/**
	 * Supports the patterns you've shown:
	 *  - "{{ value_json.pir_detected }}"
	 *  - "{{(value_json.envtemp * 0.01) | round(1)}}"
	 *
	 * This is NOT a full Jinja parser — it’s intentionally tiny.
	 */
	applyValueTemplate(template, rawStr, json)
	{
		if (!template)
		{
			// If no template, return raw (or JSON if it’s a single key? Keep it simple.)
			return json ?? rawStr;
		}

		const t = template.replace(/\s+/g, ''); // strip whitespace for easier matching

		// 1) value_json.<key>
		// e.g. "{{value_json.pir_detected}}"
		const m1 = t.match(/^\{\{value_json\.([a-zA-Z0-9_]+)\}\}$/);
		if (m1 && json && typeof json === 'object')
		{
			return json[m1[1]];
		}

		// 2) (value_json.<key>*<factor>)|round(<n>)
		// e.g. "{{(value_json.envtemp*0.01)|round(1)}}"
		const m2 = t.match(/^\{\{\(value_json\.([a-zA-Z0-9_]+)\*([0-9.]+)\)\|round\(([0-9]+)\)\}\}$/);
		if (m2 && json && typeof json === 'object')
		{
			const key = m2[1];
			const factor = Number(m2[2]);
			const decimals = Number(m2[3]);
			const raw = Number(json[key]);
			if (!Number.isFinite(raw) || !Number.isFinite(factor)) return undefined;
			const scaled = raw * factor;
			const p = Math.pow(10, decimals);
			return Math.round(scaled * p) / p;
		}

		// If we can’t interpret the template, fall back safely.
		return json ?? rawStr;
	}

	getDeviceList()
	{
		return this.devices;
	}

	changeBroker(body)
	{
		if (body.username !== undefined) this.broker.username = body.username;
		if (body.password !== undefined) this.broker.password = body.password;
		if (body.brokerURL) this.broker.url = `${body.brokerURL}`;
		if (body.brokerPort) this.broker.port = body.brokerPort;
		if (body.brokerWSPort) this.broker.wsport = body.brokerWSPort;
		if (body.useHomeyBroker !== undefined) this.broker.useHomeyBroker = body.useHomeyBroker;

		this.disconnectAllClientsAndClose();

		if (this.broker.useHomeyBroker)
		{
			this.setupHomeyMQTTServer();
		}
		else
		{
			this.setupMQTTClient(this.broker, this.app.homeyID);
		}

		this.app.homey.settings.set('brokerSettings', this.broker);
	}

};
