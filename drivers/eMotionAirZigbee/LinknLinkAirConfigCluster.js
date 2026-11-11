'use strict';

const { Cluster, ZCLDataTypes } = require('zigbee-clusters');

// LinknLink manufacturer-specific air configuration cluster (firmware >= 1.2.7)
const MANUFACTURER_ID = 0x4231;

const CONFIG_PAYLOAD_ARGS = {
	formatVersion: ZCLDataTypes.uint8,
	mask: ZCLDataTypes.uint16,
	freq: ZCLDataTypes.uint8,
	trith: ZCLDataTypes.uint8,
	absenceTimeout: ZCLDataTypes.uint16,
	radarEnable: ZCLDataTypes.uint8,
	lxInterval: ZCLDataTypes.uint16,
	shtInterval: ZCLDataTypes.uint16,
	lxThread1: ZCLDataTypes.uint16,
	lxThread2: ZCLDataTypes.uint16,
};

class LinknLinkAirConfigCluster extends Cluster
{
	static get ID()
	{
		return 0xFC00;
	}

	static get NAME()
	{
		return 'linknlinkAirConfig';
	}

	static get MANUFACTURER_ID()
	{
		return MANUFACTURER_ID;
	}

	static get ATTRIBUTES()
	{
		return {
			protocolVersion: { id: 0x0000, type: ZCLDataTypes.uint8, manufacturerId: MANUFACTURER_ID },
			freq: { id: 0x0001, type: ZCLDataTypes.uint8, manufacturerId: MANUFACTURER_ID },
			trith: { id: 0x0002, type: ZCLDataTypes.uint8, manufacturerId: MANUFACTURER_ID },
			absenceTimeout: { id: 0x0003, type: ZCLDataTypes.uint16, manufacturerId: MANUFACTURER_ID },
			radarEnable: { id: 0x0004, type: ZCLDataTypes.bool, manufacturerId: MANUFACTURER_ID },
			lxInterval: { id: 0x0005, type: ZCLDataTypes.uint16, manufacturerId: MANUFACTURER_ID },
			shtInterval: { id: 0x0006, type: ZCLDataTypes.uint16, manufacturerId: MANUFACTURER_ID },
			lxThread1: { id: 0x0007, type: ZCLDataTypes.uint16, manufacturerId: MANUFACTURER_ID },
			lxThread2: { id: 0x0008, type: ZCLDataTypes.uint16, manufacturerId: MANUFACTURER_ID },
		};
	}

	static get COMMANDS()
	{
		return {
			setConfig: {
				id: 0x01,
				manufacturerId: MANUFACTURER_ID,
				direction: Cluster.DIRECTION_CLIENT_TO_SERVER,
				args: { ...CONFIG_PAYLOAD_ARGS },
			},
			getConfig: {
				id: 0x02,
				manufacturerId: MANUFACTURER_ID,
				direction: Cluster.DIRECTION_CLIENT_TO_SERVER,
			},
			configStatus: {
				id: 0x81,
				manufacturerId: MANUFACTURER_ID,
				direction: Cluster.DIRECTION_SERVER_TO_CLIENT,
				args: {
					status: ZCLDataTypes.uint8,
					...CONFIG_PAYLOAD_ARGS,
				},
			},
			getConfigRsp: {
				id: 0x82,
				manufacturerId: MANUFACTURER_ID,
				direction: Cluster.DIRECTION_SERVER_TO_CLIENT,
				args: {
					status: ZCLDataTypes.uint8,
					...CONFIG_PAYLOAD_ARGS,
				},
			},
		};
	}

	onConfigStatus(payload)
	{
		this.emit('configStatus', payload);
	}

	onGetConfigRsp(payload)
	{
		this.emit('getConfigRsp', payload);
	}
}

Cluster.addCluster(LinknLinkAirConfigCluster);

module.exports = LinknLinkAirConfigCluster;
