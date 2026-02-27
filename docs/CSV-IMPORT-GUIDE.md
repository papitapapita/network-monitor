# CSV Bulk Import Guide - REQ-002

## Overview

The CSV Bulk Import feature allows network administrators to efficiently import multiple network devices from CSV files exported by network scanners or manually created spreadsheets.

**Key Features (REQ-002 FR-002.7):**
- Import up to 1,000 devices per CSV file
- All-or-nothing transaction (entire import succeeds or fails)
- Pre-import validation with detailed error reporting
- Support for both DRAFT and ACTIVE device creation
- CSV injection attack prevention
- Maximum file size: 10MB
- Target performance: Complete within 30 seconds for 1,000 devices

## CSV File Format

### Required Columns

- `ipAddress` - IPv4 address (e.g., `192.168.1.100`)
- `macAddress` - MAC address (e.g., `AA:BB:CC:DD:EE:FF` or `AA-BB-CC-DD-EE-FF`)

### Optional Columns

- `name` - Device name (max 255 characters)
- `deviceType` - Device type enum: `ROUTER`, `SWITCH`, `ACCESS_POINT`, `STATION`, `PTP_RADIO`, `PTMP_RADIO`, `FIREWALL`, `SERVER`, `UNKNOWN`
- `description` - Device description (max 1000 characters)
- `location` - Physical location (max 500 characters)
- `connectivityType` - Connectivity type enum: `ETHERNET`, `FIBER_OPTIC`, `WIRELESS`, `DSL`, `SATELLITE`, `OTHER`
- `managementProtocol` - Management protocol enum: `SNMP`, `SSH`, `TELNET`, `HTTP`, `HTTPS`, `OTHER`
- `managementPort` - Management port number (1-65535)
- `enabledRemoteAccess` - Remote access enabled (true/false, 1/0, yes/no)
- `deviceId` - External device identifier (auto-generated if not provided)

### CSV Template

```csv
ipAddress,macAddress,name,deviceType,description,location,connectivityType,managementProtocol,managementPort,enabledRemoteAccess,deviceId
192.168.1.100,AA:BB:CC:DD:EE:FF,Router-Core-01,ROUTER,Main core router,Building A Floor 2,ETHERNET,SNMP,161,false,device-001
192.168.1.101,AA:BB:CC:DD:EE:FE,Switch-Access-01,SWITCH,Access switch,Building A Floor 1,FIBER_OPTIC,SSH,22,true,device-002
192.168.1.102,AA:BB:CC:DD:EE:FD,AP-Guest-01,ACCESS_POINT,Guest network AP,Building B Floor 1,WIRELESS,HTTPS,443,true,device-003
```

**Download Template:**
```bash
curl http://localhost:3000/api/devices/import/template > devices-template.csv
```

## Import Modes

### DRAFT Mode (Default)

Devices are created with `activationStatus=DRAFT` and minimal validation.

- Only IP, MAC required
- Name and deviceType optional
- Devices excluded from monitoring
- Use for network discovery workflows

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/devices/import \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@devices.csv" \
  -F "activateImmediately=false"
```

### ACTIVE Mode

Devices are created with `activationStatus=ACTIVE` immediately.

- IP, MAC, name, deviceType required
- Full validation applied
- Devices included in monitoring
- Use for manual device registration

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/devices/import \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@devices.csv" \
  -F "activateImmediately=true"
```

## API Endpoint

### POST /api/devices/import

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Authentication: Required (JWT)
- Permissions: `device:create` (Admin, Operator)

**Request Parameters:**
- `file` (required): CSV file (multipart/form-data)
- `activateImmediately` (optional): Boolean, default `false`

**Response (Success):**
```json
{
  "success": true,
  "created": 50,
  "failed": 0,
  "deviceIds": [
    "abc-123-def-456",
    "ghi-789-jkl-012",
    ...
  ],
  "duration": 2345
}
```

**Response (Validation Errors):**
```json
{
  "success": false,
  "created": 0,
  "failed": 50,
  "deviceIds": [],
  "validationErrors": [
    {
      "row": 5,
      "field": "ipAddress",
      "value": "192.168.1.999",
      "error": "Invalid IP address: Octet 999 exceeds 255"
    },
    {
      "row": 12,
      "field": "macAddress",
      "value": "AA:BB:CC",
      "error": "Invalid MAC address: Must contain 6 octets"
    },
    {
      "row": 18,
      "field": "ipAddress",
      "value": "192.168.1.100",
      "error": "IP address already exists in database"
    }
  ],
  "duration": 1250
}
```

**HTTP Status Codes:**
- `200 OK`: Import processed (check `success` field for actual result)
- `400 Bad Request`: Invalid request (file missing, wrong format)
- `401 Unauthorized`: No authentication token
- `403 Forbidden`: Insufficient permissions
- `413 Payload Too Large`: File >10MB
- `500 Internal Server Error`: Unexpected error

## Validation Rules

### Pre-Import Validation

All rows are validated BEFORE any devices are created:

1. **CSV Structure**:
   - Header row present
   - Required columns present
   - No unknown columns
   - Valid CSV format (quoted fields, escaped quotes)

2. **Field Format**:
   - IP address: Valid IPv4 format (regex validation)
   - MAC address: Valid format (AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)
   - Enum fields: Valid enum values (deviceType, connectivityType, managementProtocol)
   - Port: Integer 1-65535
   - Boolean: true/false, 1/0, yes/no

3. **Field Length**:
   - Name: Max 255 characters
   - Description: Max 1000 characters
   - Location: Max 500 characters

4. **Uniqueness (Within CSV)**:
   - No duplicate IP addresses within CSV
   - No duplicate MAC addresses within CSV

5. **Uniqueness (Against Database)**:
   - IP address not already in database
   - MAC address not already in database

### Validation Error Reporting

If ANY validation fails, the ENTIRE import is rejected with:
- Row number (1-indexed, excluding header)
- Field name
- Problematic value
- Clear error message

**Example Error Report:**
```json
{
  "row": 15,
  "field": "deviceType",
  "value": "GATEWAY",
  "error": "Invalid device type. Must be one of: ROUTER, SWITCH, ACCESS_POINT, STATION, PTP_RADIO, PTMP_RADIO, FIREWALL, SERVER, UNKNOWN"
}
```

## Transaction Behavior

### All-or-Nothing Transaction

- **Success**: All devices created in single database transaction
- **Failure**: Entire transaction rolled back, zero devices created
- **Atomic**: No partial imports

**Example:**
- CSV contains 100 rows
- Row 95 has invalid IP address
- Result: **0 devices created, 100 failed**
- Fix row 95, re-import entire file

## Common Errors and Solutions

### Error: "CSV file is empty"

**Cause**: File contains only whitespace or no rows.

**Solution**: Ensure file contains header row and at least one data row.

---

### Error: "Missing required columns: ipAddress, macAddress"

**Cause**: CSV header row missing required columns or column names misspelled.

**Solution**: Verify header row matches exactly (case-sensitive):
```csv
ipAddress,macAddress,name
```

---

### Error: "File size 12.5MB exceeds maximum 10MB"

**Cause**: CSV file too large.

**Solution**: Split into multiple files:
```bash
# Split into 1000-row chunks
split -l 1001 devices.csv devices-chunk-
# (1001 = 1 header + 1000 data rows)
```

---

### Error: "Invalid IP address: Octet 999 exceeds 255"

**Cause**: Malformed IP address in CSV.

**Solution**: Fix IP address format in row indicated by error.

---

### Error: "IP address already exists in database"

**Cause**: IP address in CSV row already exists in database.

**Solution**:
1. Check if device intentionally exists (remove from CSV)
2. Delete existing device first if replacement intended
3. Use device replacement workflow instead

---

### Error: "Duplicate IP address within CSV (first occurrence at different row)"

**Cause**: Same IP address appears multiple times in CSV.

**Solution**: Remove duplicate rows or fix IP addresses to be unique.

---

### Error: "Device type must be one of: ROUTER, SWITCH, ..."

**Cause**: Invalid or misspelled device type in CSV.

**Solution**: Use exact enum values (case-insensitive):
- Correct: `ROUTER`, `router`, `Router`
- Incorrect: `GATEWAY`, `Route`, `Ruter`

## Best Practices

### 1. Validate Before Upload

Use offline tools to validate CSV before upload:

```bash
# Check row count
wc -l devices.csv

# Check for duplicate IPs
cut -d',' -f1 devices.csv | sort | uniq -d

# Check for duplicate MACs
cut -d',' -f2 devices.csv | sort | uniq -d

# Validate IP format (basic check)
grep -Ev '^([0-9]{1,3}\.){3}[0-9]{1,3},' devices.csv
```

### 2. Use Template

Always start with the official template:
```bash
curl http://localhost:3000/api/devices/import/template > template.csv
```

### 3. Test with Small Batch First

Test with 5-10 devices before importing 1,000:
```bash
head -6 devices.csv > test.csv  # Header + 5 rows
# Import test.csv, verify success
# Then import full devices.csv
```

### 4. Handle Errors Systematically

1. Import CSV
2. If errors, download error report
3. Fix errors in CSV
4. Re-import entire file (all-or-nothing)

### 5. Batch Large Imports

For >1,000 devices, split into batches:
```bash
# Split into 1000-row chunks
split -l 1001 devices.csv chunk-

# Import each chunk
for file in chunk-*; do
  curl -X POST http://localhost:3000/api/devices/import \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$file"
done
```

### 6. Use DRAFT Mode for Discovery

For network discovery workflows:
1. Export devices from network scanner to CSV
2. Import with `activateImmediately=false` (DRAFT mode)
3. Enrich devices in UI (add names, types, locations)
4. Activate devices individually or in bulk

## Security Considerations

### CSV Injection Prevention

The parser automatically strips leading `=`, `+`, `-`, `@` from cell values to prevent CSV injection attacks (formula execution in Excel/Google Sheets).

**Example:**
```csv
ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,=SUM(A1:A10)  # Dangerous!
```

**Sanitized:**
```csv
ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,SUM(A1:A10)  # Safe
```

### File Upload Limits

- **Max file size**: 10MB
- **Max rows**: 1,000 devices per import
- **File type**: text/csv, application/csv

### Rate Limiting

CSV imports are rate-limited to prevent abuse:
- **Limit**: 5 imports per hour per user
- **Status Code**: 429 Too Many Requests
- **Retry-After**: Header indicates when to retry

## Performance

### Expected Performance (NFR-002.3)

- **Target**: 1,000 devices within 30 seconds
- **Throughput**: ~33 devices/second
- **Database**: Uses single transaction for atomicity

### Optimization Tips

1. **Pre-sort by IP**: Improves database index performance
2. **Remove duplicates**: Reduces validation time
3. **Use simple device types**: Avoid complex enum values
4. **Disable browser extensions**: For upload performance

## Example Workflows

### Workflow 1: Network Discovery

```bash
# 1. Export from network scanner
nmap -sn 192.168.1.0/24 -oX scan.xml
python3 nmap2csv.py scan.xml > discovered-devices.csv

# 2. Import as DRAFT
curl -X POST http://localhost:3000/api/devices/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@discovered-devices.csv" \
  -F "activateImmediately=false"

# 3. Enrich in UI (add names, types, locations)

# 4. Activate individually via UI or API
```

### Workflow 2: Manual Registration

```bash
# 1. Create CSV with full device details
cat > devices.csv << EOF
ipAddress,macAddress,name,deviceType,location
192.168.1.1,AA:BB:CC:DD:EE:FF,Router-Core,ROUTER,Datacenter Rack 1
192.168.1.2,AA:BB:CC:DD:EE:FE,Switch-Core,SWITCH,Datacenter Rack 1
EOF

# 2. Import as ACTIVE
curl -X POST http://localhost:3000/api/devices/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@devices.csv" \
  -F "activateImmediately=true"

# 3. Devices immediately available in monitoring
```

### Workflow 3: Migration from Legacy System

```bash
# 1. Export from legacy system to CSV
mysql legacy_db -e "SELECT ip, mac, name, type, location FROM devices" > legacy-export.txt

# 2. Convert to required format
python3 convert-legacy.py legacy-export.txt > devices.csv

# 3. Validate format
head -5 devices.csv
# Verify columns match template

# 4. Test with small batch
head -6 devices.csv > test.csv
curl -X POST http://localhost:3000/api/devices/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.csv"

# 5. Import full dataset in batches
split -l 1001 devices.csv batch-
for file in batch-*; do
  curl -X POST http://localhost:3000/api/devices/import \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$file"
  sleep 5  # Rate limiting
done
```

## Frontend Integration

### File Upload Component (React Example)

```typescript
import React, { useState } from 'react';
import axios from 'axios';

function CSVImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('activateImmediately', String(activateImmediately));

    try {
      const response = await axios.post('/api/devices/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      setResult(response.data);
    } catch (error) {
      console.error('Import failed', error);
      setResult({ success: false, error: 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Bulk Import Devices</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <label>
          <input
            type="checkbox"
            checked={activateImmediately}
            onChange={(e) => setActivateImmediately(e.target.checked)}
          />
          Activate immediately
        </label>
        <button type="submit" disabled={!file || loading}>
          {loading ? 'Importing...' : 'Import'}
        </button>
      </form>

      {result && (
        <div>
          {result.success ? (
            <div className="success">
              <h3>Import Successful!</h3>
              <p>Created {result.created} devices in {result.duration}ms</p>
            </div>
          ) : (
            <div className="error">
              <h3>Import Failed</h3>
              <p>{result.failed} devices failed validation</p>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>Value</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.validationErrors?.map((err, i) => (
                    <tr key={i}>
                      <td>{err.row}</td>
                      <td>{err.field}</td>
                      <td>{err.value}</td>
                      <td>{err.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Related Documentation

- [REQ-002: Network Device CRUD](/docs/requirements/REQ-002-network-device-crud.md)
- [BulkImportNetworkDevicesUseCase](/src/application/use-cases/BulkImportNetworkDevicesUseCase.ts)
- [CSVParser](/src/infrastructure/csv/CSVParser.ts)
- [API Documentation](/docs/API.md)
