'use strict';

function getKnownAvailabilityStates(device, entityMatcher)
{
	const deviceId = device.getData().id;
	const entities = Array.from(device.homey.app.linknLinkAPI.entities.values())
		.filter((entity) => entity.deviceId === deviceId && entityMatcher(entity));

	return entities
		.map((entity) => entity.isAvailable)
		.filter((state) => typeof state === 'boolean');
}

function getAggregatedAvailabilityByNames(device, entityNames)
{
	const nameSet = new Set(entityNames);
	const knownStates = getKnownAvailabilityStates(device, (entity) => nameSet.has(entity.name));

	if (knownStates.length === 0)
	{
		return null;
	}

	return knownStates.some((state) => state === true);
}

function getCapabilityVisibilityDecisionByNames(device, entityNames)
{
	const deviceId = device.getData().id;
	const nameSet = new Set(entityNames);
	const deviceEntities = Array.from(device.homey.app.linknLinkAPI.entities.values())
		.filter((entity) => entity.deviceId === deviceId);

	const matchedEntities = deviceEntities.filter((entity) => nameSet.has(entity.name));
	const onlineCount = matchedEntities.filter((entity) => entity.isAvailable === true).length;
	const offlineCount = matchedEntities.filter((entity) => entity.isAvailable === false).length;
	const unknownCount = matchedEntities.length - onlineCount - offlineCount;

	if (onlineCount > 0)
	{
		return {
			decided: true,
			shouldBeVisible: true,
			reason: 'mapped-entity-online',
			matchedCount: matchedEntities.length,
			onlineCount,
			offlineCount,
			unknownCount,
		};
	}

	if (offlineCount > 0)
	{
		return {
			decided: true,
			shouldBeVisible: false,
			reason: 'mapped-entity-offline',
			matchedCount: matchedEntities.length,
			onlineCount,
			offlineCount,
			unknownCount,
		};
	}

	if (matchedEntities.length > 0)
	{
		return {
			decided: false,
			shouldBeVisible: false,
			reason: 'mapped-entity-availability-unknown',
			matchedCount: matchedEntities.length,
			onlineCount,
			offlineCount,
			unknownCount,
		};
	}

	const deviceHasKnownAvailability = deviceEntities.some((entity) => typeof entity.isAvailable === 'boolean');
	if (deviceHasKnownAvailability)
	{
		return {
			decided: true,
			shouldBeVisible: false,
			reason: 'mapped-entity-absent-after-device-availability-known',
			matchedCount: 0,
			onlineCount: 0,
			offlineCount: 0,
			unknownCount: 0,
		};
	}

	return {
		decided: false,
		shouldBeVisible: false,
		reason: 'mapped-entity-absent-before-device-availability-known',
		matchedCount: 0,
		onlineCount: 0,
		offlineCount: 0,
		unknownCount: 0,
	};
}

function logCapabilityVisibilityDecision(device, capability, entityNames, decision, sourceEntityName)
{
	if (!device._capabilityVisibilityDebugState)
	{
		device._capabilityVisibilityDebugState = new Map();
	}

	const hasCapability = device.hasCapability(capability);
	const decisionSignature = JSON.stringify({
		capability,
		hasCapability,
		decided: decision.decided,
		shouldBeVisible: decision.shouldBeVisible,
		reason: decision.reason,
		matchedCount: decision.matchedCount,
		onlineCount: decision.onlineCount,
		offlineCount: decision.offlineCount,
		unknownCount: decision.unknownCount,
		sourceEntityName,
	});

	if (device._capabilityVisibilityDebugState.get(capability) === decisionSignature)
	{
		return;
	}

	device._capabilityVisibilityDebugState.set(capability, decisionSignature);
	const decisionSummary = [
		`decided=${decision.decided}`,
		`visible=${decision.shouldBeVisible}`,
		`reason=${decision.reason}`,
		`matched=${decision.matchedCount}`,
		`online=${decision.onlineCount}`,
		`offline=${decision.offlineCount}`,
		`unknown=${decision.unknownCount}`,
		`source=${sourceEntityName}`,
		`mapped=${entityNames.join(',')}`,
	].join(', ');
	device.homey.app.updateLog(
		`Capability visibility decision for ${device.getName()} capability ${capability}: ${decisionSummary}`,
		1,
	);
}

async function syncCapabilityVisibility(device, capability, shouldBeVisible)
{
	const hasCapability = device.hasCapability(capability);

	if (shouldBeVisible && !hasCapability)
	{
		await device.addCapability(capability);
		device.homey.app.updateLog(`Added capability ${capability} on ${device.getName()} based on entity availability`, 1);
		return;
	}

	if (!shouldBeVisible && hasCapability)
	{
		await device.removeCapability(capability);
		device.homey.app.updateLog(`Removed capability ${capability} on ${device.getName()} based on entity availability`, 1);
	}
}

async function syncCapabilitiesByEntityNameMap(device, mqttMessage, capabilityAvailabilityMap)
{
	if (!mqttMessage || mqttMessage.deviceId !== device.getData().id)
	{
		return false;
	}

	let handled = false;

	for (const [capability, entityNamesValue] of Object.entries(capabilityAvailabilityMap))
	{
		const entityNames = Array.isArray(entityNamesValue) ? entityNamesValue : [entityNamesValue];
		const decision = getCapabilityVisibilityDecisionByNames(device, entityNames);
		logCapabilityVisibilityDecision(device, capability, entityNames, decision, mqttMessage.name);
		if (!decision.decided)
		{
			continue;
		}

		await syncCapabilityVisibility(device, capability, decision.shouldBeVisible);
		handled = true;
	}

	return handled;
}

async function syncCapabilitiesByEntityMatcher(device, mqttMessage, capabilities, entityMatcher)
{
	if (!mqttMessage || mqttMessage.deviceId !== device.getData().id)
	{
		return false;
	}

	if (!entityMatcher(mqttMessage))
	{
		return false;
	}

	const knownStates = getKnownAvailabilityStates(device, entityMatcher);
	if (knownStates.length === 0)
	{
		return false;
	}

	const nextVisible = knownStates.some((state) => state === true);
	for (const capability of capabilities)
	{
		await syncCapabilityVisibility(device, capability, nextVisible);
	}

	return true;
}

module.exports = {
	getAggregatedAvailabilityByNames,
	syncCapabilitiesByEntityNameMap,
	syncCapabilitiesByEntityMatcher,
	syncCapabilityVisibility,
};
