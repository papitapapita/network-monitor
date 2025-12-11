# NetworkDevice Entity - Recommended Modifications for CRUD Events

## Summary
Add event emission to update and delete methods for proper audit trail and system integration.

## Changes Required

### 1. Import new events at the top of NetworkDevice.ts

```typescript
import {
  // ... existing imports
  NetworkDeviceUpdatedEvent,
  NetworkDeviceDeletedEvent
} from '../';
```

### 2. Modify `updateName()` method

**Current:**
```typescript
public updateName(newName: string): Result<void> {
  // ... validation code ...

  this.props.name = newName;
  this.props.updatedAt = new Date();

  return Result.ok<void>();
}
```

**Modified:**
```typescript
public updateName(newName: string): Result<void> {
  // ... validation code ...

  const oldName = this.props.name;
  this.props.name = newName;
  this.props.updatedAt = new Date();

  // Emit update event if name actually changed
  if (oldName !== newName) {
    this.addDomainEvent(
      new NetworkDeviceUpdatedEvent(
        this.id,
        this.name,
        ['name'],
        { name: oldName },
        { name: newName }
      )
    );
  }

  return Result.ok<void>();
}
```

### 3. Modify `updateDescription()` method

**Modified:**
```typescript
public updateDescription(description: string | null): Result<void> {
  if (description !== null && description.length > 1000) {
    return Result.fail<void>(
      'Description cannot exceed 1000 characters'
    );
  }

  const oldDescription = this.props.description;
  this.props.description = description;
  this.props.updatedAt = new Date();

  // Emit update event if description actually changed
  if (oldDescription !== description) {
    this.addDomainEvent(
      new NetworkDeviceUpdatedEvent(
        this.id,
        this.name,
        ['description'],
        { description: oldDescription },
        { description: description }
      )
    );
  }

  return Result.ok<void>();
}
```

### 4. Modify `updateManagementConfig()` method

**Modified:**
```typescript
public updateManagementConfig(config: {
  protocol?: ManagementProtocol;
  port?: number;
  enableRemoteAccess?: boolean;
}): Result<void> {
  const changedFields: string[] = [];
  const previousValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  if (config.port !== undefined) {
    const portGuard = Guard.combine([
      Guard.isNumber(config.port, 'port'),
      Guard.inRange(config.port, 1, 65535, 'port')
    ]);

    if (!portGuard.succeeded) {
      return Result.fail<void>(portGuard.message!);
    }

    if (this.props.managementPort !== config.port) {
      changedFields.push('managementPort');
      previousValues.managementPort = this.props.managementPort;
      newValues.managementPort = config.port;
      this.props.managementPort = config.port;
    }
  }

  if (config.protocol !== undefined) {
    if (this.props.managementProtocol !== config.protocol) {
      changedFields.push('managementProtocol');
      previousValues.managementProtocol = this.props.managementProtocol;
      newValues.managementProtocol = config.protocol;
      this.props.managementProtocol = config.protocol;
    }
  }

  if (config.enableRemoteAccess !== undefined) {
    if (this.props.enabledRemoteAccess !== config.enableRemoteAccess) {
      changedFields.push('enabledRemoteAccess');
      previousValues.enabledRemoteAccess = this.props.enabledRemoteAccess;
      newValues.enabledRemoteAccess = config.enableRemoteAccess;
      this.props.enabledRemoteAccess = config.enableRemoteAccess;
    }
  }

  this.props.updatedAt = new Date();

  // Emit event if anything actually changed
  if (changedFields.length > 0) {
    this.addDomainEvent(
      new NetworkDeviceUpdatedEvent(
        this.id,
        this.name,
        changedFields,
        previousValues,
        newValues
      )
    );
  }

  return Result.ok<void>();
}
```

### 5. Add `markForDeletion()` method (NEW)

Add this method to NetworkDevice class:

```typescript
/**
 * Marks the device for deletion and emits deletion event.
 * Call this BEFORE physically deleting from repository.
 *
 * This ensures the deletion event is emitted with full device context
 * before the data is permanently removed.
 *
 * @param deletedBy - Optional identifier of who/what requested deletion
 * @returns Result indicating success or failure
 */
public markForDeletion(deletedBy?: string): Result<void> {
  // Emit deletion event with current device state
  this.addDomainEvent(
    new NetworkDeviceDeletedEvent(
      this.id,
      this.name,
      this.ipAddress.toString(),
      this.macAddress.toString(),
      this.deviceType.toString(),
      deletedBy
    )
  );

  return Result.ok<void>();
}
```

### 6. Update DeleteNetworkDeviceUseCase

Modify the executeImpl method to emit event before deletion:

```typescript
protected async executeImpl(
  request: DeleteNetworkDeviceDTO
): Promise<Result<void>> {
  // ... existing validation code ...

  // Fetch device to emit deletion event with full context
  const deviceResult = await this.deviceRepository.findById(deviceId.value);
  if (deviceResult.isFailure) {
    return this.fail<void>(deviceResult.error!);
  }

  if (!deviceResult.value) {
    return this.fail<void>(
      `Network device with ID ${request.id} not found`
    );
  }

  const device = deviceResult.value;

  // Mark for deletion (emits event)
  const markResult = device.markForDeletion();
  if (markResult.isFailure) {
    return this.fail<void>(markResult.error!);
  }

  // Save to dispatch deletion event BEFORE physical deletion
  await this.deviceRepository.save(device);

  // Log deletion for audit trail
  this.logger.warn(`Deleting network device ${request.id}`, {
    note: 'This will permanently delete the device and all associated polling data'
  });

  // Delete device (CASCADE handles related data)
  const deleteResult = await this.deviceRepository.delete(deviceId.value);
  if (deleteResult.isFailure) {
    return this.fail<void>(deleteResult.error!);
  }

  return this.ok<void>(undefined);
}
```

## Event Emission Summary

After these changes, events will be emitted for:

✅ **Create** - `NetworkDeviceCreatedEvent` (already implemented)
✅ **Update Name** - `NetworkDeviceUpdatedEvent` with `changedFields: ['name']`
✅ **Update Description** - `NetworkDeviceUpdatedEvent` with `changedFields: ['description']`
✅ **Update Management Config** - `NetworkDeviceUpdatedEvent` with `changedFields: ['managementPort', ...]`
✅ **Delete** - `NetworkDeviceDeletedEvent` (new)
✅ **Status Change** - `NetworkDeviceStatusChangedEvent` (already implemented)
✅ **Polling Config** - `PollingIntervalChangedEvent`, `PingCountChangedEvent`, etc. (already implemented)

## Why These Events Matter

1. **Audit Trail** - Track all changes for compliance (SOC 2, ISO 27001)
2. **Integration** - Sync with external systems (CMDB, monitoring, inventory)
3. **Notifications** - Alert administrators of critical changes
4. **Analytics** - Track device lifecycle and change frequency
5. **Debugging** - Reconstruct device state history for troubleshooting

## Alternative: No Update Events

If you decide update events are **too granular** for your needs:
- **Keep:** NetworkDeviceDeletedEvent (critical for audit)
- **Remove:** NetworkDeviceUpdatedEvent
- **Reason:** Use database audit logging for CRUD changes instead
- **Benefit:** Simpler codebase, fewer events to handle

The choice depends on:
- Do other bounded contexts need to react to device updates?
- Do you need real-time notifications for device changes?
- Is audit trail via events required, or is DB audit log sufficient?
