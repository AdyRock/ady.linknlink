'use strict';

if (process.env.DEBUG === '1')
{
	// eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
	require('inspector').open(9223, '0.0.0.0', true);
}

const Homey = require('homey');
const LinknLinkAPI = require('./linknlinkapi');
const nodemailer = require('./nodemailer');

module.exports = class LinknLink extends Homey.App
{

	/**
	 * onInit is called when the app is initialized.
	 */
	async onInit()
	{
		this.linknLinkAPI = new LinknLinkAPI(this);
		this.homeyID = await this.homey.cloud.getHomeyId();

		// Setup Flow actions, conditions and triggers
		this.alarm_presence_zone1_false = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone1_false');
		this.alarm_presence_zone1_true = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone1_true');
		this.alarm_presence_zone2_false = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone2_false');
		this.alarm_presence_zone2_true = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone2_true');
		this.alarm_presence_zone3_false = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone3_false');
		this.alarm_presence_zone3_true = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone3_true');
		this.alarm_presence_zone4_false = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone4_false');
		this.alarm_presence_zone4_true = this.homey.flow.getDeviceTriggerCard('alarm_presence_zone4_true');
		this.measure_people_count_changed = this.homey.flow.getDeviceTriggerCard('measure_people_count_changed');
		this.measure_people_count_zone1_changed = this.homey.flow.getDeviceTriggerCard('measure_people_count_zone1_changed');
		this.measure_people_count_zone2_changed = this.homey.flow.getDeviceTriggerCard('measure_people_count_zone2_changed');
		this.measure_people_count_zone3_changed = this.homey.flow.getDeviceTriggerCard('measure_people_count_zone3_changed');
		this.measure_people_count_zone4_changed = this.homey.flow.getDeviceTriggerCard('measure_people_count_zone4_changed');

		this.homey.settings.on('set', async (setting) =>
		{
		});

		this.deviceIndex = new Map(); // did -> driverId

		this.linknLinkAPI.setupHomeyMQTTServer();

		this.updateLog('LinknLink app has been initialized');
	}

	trigger_alarm_presence_zone1_false(device)
	{
		this.alarm_presence_zone1_false.trigger(device);
	}

	trigger_alarm_presence_zone1_true(device)
	{
		this.alarm_presence_zone1_true.trigger(device);
	}

	trigger_alarm_presence_zone2_false(device)
	{
		this.alarm_presence_zone2_false.trigger(device);
	}

	trigger_alarm_presence_zone2_true(device)
	{
		this.alarm_presence_zone2_true.trigger(device);
	}

	trigger_alarm_presence_zone3_false(device)
	{
		this.alarm_presence_zone3_false.trigger(device);
	}

	trigger_alarm_presence_zone3_true(device)
	{
		this.alarm_presence_zone3_true.trigger(device);
	}

	trigger_alarm_presence_zone4_false(device)
	{
		this.alarm_presence_zone4_false.trigger(device);
	}

	trigger_alarm_presence_zone4_true(device)
	{
		this.alarm_presence_zone4_true.trigger(device);
	}

	trigger_measure_people_count_changed(device)
	{
		this.measure_people_count_changed.trigger(device);
	}

	trigger_measure_people_count_zone1_changed(device)
	{
		this.measure_people_count_zone1_changed.trigger(device);
	}

	trigger_measure_people_count_zone2_changed(device)
	{
		this.measure_people_count_zone2_changed.trigger(device);
	}

	trigger_measure_people_count_zone3_changed(device)
	{
		this.measure_people_count_zone3_changed.trigger(device);
	}

	trigger_measure_people_count_zone4_changed(device)
	{
		this.measure_people_count_zone4_changed.trigger(device);
	}

	registerDevice(did, driverId)
	{
		this.deviceIndex.set(did, driverId);
		this.linknLinkAPI.flushPendingMessagesForDevice(did);
	}

	unregisterDevice(did)
	{
		this.deviceIndex.delete(did);
		this.linknLinkAPI.removePendingMessagesForDevice(did);
	}

	getDeviceByDid(did)
	{
		const driverId = this.deviceIndex.get(did);
		if (!driverId) return null;

		const driver = this.homey.drivers.getDriver(driverId);
		if (!driver) return null;

		return driver.getDevices()
			.find((d) => d.getData().id === did);
	}

	// Convert a variable of any type (almost) to a string
	varToString(source)
	{
		try
		{
			const getCircularReplacer = () =>
			{
				const seen = new WeakSet();
				return (key, value) =>
				{
					if (value instanceof Map)
					{
						return Array.from(value.entries());
					}
					if (value instanceof Set)
					{
						return Array.from(value);
					}
					if (typeof value === 'object' && value !== null)
					{
						if (seen.has(value))
						{
							return '';
						}
						seen.add(value);
					}
					return value;
				};
			};

			if (source === null)
			{
				return 'null';
			}
			if (source === undefined)
			{
				return 'undefined';
			}
			if (source instanceof Error)
			{
				const stack = source.stack.replace('/\\n/g', '\n');
				return `${source.message}\n${stack}`;
			}
			if (typeof (source) === 'object')
			{
				return JSON.stringify(source, getCircularReplacer(), 2);
			}
			if (typeof (source) === 'string')
			{
				return source;
			}
		}
		catch (err)
		{
			this.updateLog(`VarToString Error: ${err.message}`);
		}

		return source.toString();
	}

	// Add a message to the debug log if not running in the cloud
	updateLog(newMessage, errorLevel = 1)
	{
		if ((errorLevel === 0) || this.homey.settings.get('logEnabled'))
		{
			if (errorLevel === 0)
			{
				this.error(newMessage);
			}
			else
			{
				this.log(newMessage);
			}

			try
			{
				const nowTime = new Date(Date.now());

				this.diagLog += '\r\n* ';
				this.diagLog += nowTime.toJSON();
				this.diagLog += '\r\n';

				this.diagLog += newMessage;
				this.diagLog += '\r\n';
				if (this.diagLog.length > 60000)
				{
					this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
				}

				if (!this.cloudOnly)
				{
					this.homey.api.realtime('ady.linknlink.logupdated', { log: this.diagLog });
				}
			}
			catch (err)
			{
				this.log(err);
			}
		}
	}

	getLog()
	{
		return this.diagLog;
	}

	clearLog()
	{
		this.diagLog = '';
		this.homey.api.realtime('ady.linknlink.logupdated', { log: this.diagLog });
	}

	// Send the log to the developer (not applicable to Homey cloud)
	async sendLog({ email = '', description = '', log = '' })
	{
		let tries = 5;
		let error = null;
		while (tries-- > 0)
		{
			try
			{
				// create reusable transporter object using the default SMTP transport
				const transporter = nodemailer.createTransport(
					{
						host: Homey.env.MAIL_HOST, // Homey.env.MAIL_HOST,
						port: 465,
						ignoreTLS: false,
						secure: true, // true for 465, false for other ports
						auth:
						{
							user: Homey.env.MAIL_USER, // generated ethereal user
							pass: Homey.env.MAIL_SECRET, // generated ethereal password
						},
						tls:
						{
							// do not fail on invalid certs
							rejectUnauthorized: false,
						},
					},
				);

				// send mail with defined transport object
				const info = await transporter.sendMail(
					{
						from: `"Homey User" <${Homey.env.MAIL_USER}>`, // sender address
						to: Homey.env.MAIL_RECIPIENT, // list of receivers
						cc: email,
						subject: `LinknLink log (${Homey.manifest.version})`, // Subject line
						text: `${email}\n${description}\n\n${log}`, // plain text body
					},
				);

				this.updateLog(`Message sent: ${info.messageId}`);
				// Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

				// Preview only available when sending through an Ethereal account
				this.log('Preview URL: ', nodemailer.getTestMessageUrl(info));
				return this.homey.__('settings.logSent');
			}
			catch (err)
			{
				this.updateLog(`Send log error: ${err.message}`, 0);
				error = err;
			}
		}

		throw new Error(this.homey.__('settings.logSendFailed') + error.message);
	}

	getDeviceList(body)
	{
		const deviceList = this.linknLinkAPI.getDeviceList();

		// deviceList is a Map, convert to string
		const deviceText = this.varToString(deviceList);
		return deviceText;
	}

	changeBroker(body)
	{
		return this.linknLinkAPI.changeBroker(body);
	}
};
