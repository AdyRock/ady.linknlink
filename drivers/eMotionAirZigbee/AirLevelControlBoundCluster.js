'use strict';

const { BoundCluster } = require('zigbee-clusters');

module.exports = class AirLevelControlBoundCluster extends BoundCluster
{
	constructor(onEvent)
	{
		super();
		this.onEvent = onEvent;
	}

	moveToLevel()
	{
		this.onEvent('Double Press', 'move_to_level');
	}

	move({ moveMode })
	{
		this.onEvent('Long Press', `move_${moveMode}`);
	}

	step({ mode })
	{
		this.onEvent(mode === 'down' ? 'Triple Press' : 'Double Press', `step_${mode}`);
	}

	stop()
	{
		this.onEvent('Release', 'stop');
	}

	moveToLevelWithOnOff()
	{
		this.onEvent('Double Press', 'move_to_level_with_on_off');
	}

	moveWithOnOff({ moveMode })
	{
		this.onEvent('Long Press', `move_with_on_off_${moveMode}`);
	}

	stepWithOnOff({ mode })
	{
		this.onEvent(mode === 'down' ? 'Triple Press' : 'Double Press', `step_with_on_off_${mode}`);
	}

	stopWithOnOff()
	{
		this.onEvent('Release', 'stop_with_on_off');
	}
};
