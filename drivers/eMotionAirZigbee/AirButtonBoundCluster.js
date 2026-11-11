'use strict';

const { BoundCluster } = require('zigbee-clusters');

module.exports = class AirButtonBoundCluster extends BoundCluster
{
	constructor(onAction)
	{
		super();
		this.onAction = onAction;
	}

	buttonAction({ actionId, actionStr } = {})
	{
		this.onAction(actionId, actionStr);
	}
};
