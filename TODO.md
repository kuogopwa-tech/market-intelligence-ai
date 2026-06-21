# TODO — Fix Background Intelligence Engine Error False Positive

## Root cause
The deriv-analyst UI “Background Intelligence Engine” status card incorrectly maps the **idle/success** state as **Error**.

Specifically, the UI considers the engine “healthy/active” only when:
- `status.running === true` AND
- `status.lastError` is falsy

When scans complete, backend sets:
- `running: false`
- `isScanning: false`
- `lastError: null`

However, because `status.running` is `false`, the UI derives `isHealthy = false` and therefore renders **Error** even though the backend is healthy.

## Evidence
- Backend is healthy and continuously returns 200:
  - `GET /api/intelligence/status` returns:
    - `running: false`
    - `isScanning: false`
    - `lastError: null`
    - `totalScans: 114`
- Background scans complete successfully:
  - `succeeded: 13`
  - `failed: 0`
- File being changed (UI only):
  - `artifacts/deriv-analyst/src/pages/intelligence.tsx`
- Scope:
  - UI state mapping only
  - No backend/API/database changes

## Verification expected after fix
- Confirm “Background Intelligence Engine” no longer shows **Error** for:
  - `running=false + lastError=null`
- Confirm expected transitions:
  - idle/success → **Active**
  - scanning → **Scanning…**
  - error → **Error**

## Notes / Constraints
- Do not change backend intelligence route / scan engine / DB schema.
- Modify only the StatusCard state mapping logic.
