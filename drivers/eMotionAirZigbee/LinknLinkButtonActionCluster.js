'use strict';

const { Cluster, ZCLDataTypes } = require('zigbee-clusters');

// LinknLink manufacturer-specific button action cluster (firmware >= 1.2.7)
const MANUFACTURER_ID = 0x4231;

class LinknLinkButtonActionCluster extends Cluster
{
	static get ID()
	{
		return 0xFC01;
	}

	static get NAME()
	{
		return 'linknlinkButtonAction';
	}

	static get MANUFACTURER_ID()
	{
		return MANUFACTURER_ID;
	}

	static get COMMANDS()
	{
		return {
			buttonAction: {
				id: 0x00,
				manufacturerId: MANUFACTURER_ID,
				args: {
					actionId: ZCLDataTypes.uint8,
					actionStr: ZCLDataTypes.string,
				},
			},
		};
	}

	onButtonAction(payload)
	{
		this.emit('buttonAction', payload);
	}
}

Cluster.addCluster(LinknLinkButtonActionCluster);

module.exports = LinknLinkButtonActionCluster;
