'use strict';

const { BoundCluster } = require('zigbee-clusters');

module.exports = class AirOnOffBoundCluster extends BoundCluster
{
	constructor(onEvent)
	{
		super();
		this.onEvent = onEvent;
	}

	setOn()
	{
		this.onEvent('Double Press', 'on');
	}

	setOff()
	{
		this.onEvent('Triple Press', 'off');
	}

	toggle()
	{
		this.onEvent('Press', 'toggle');
	}

	offWithEffect()
	{
		this.onEvent('Triple Press', 'off_with_effect');
	}
};
