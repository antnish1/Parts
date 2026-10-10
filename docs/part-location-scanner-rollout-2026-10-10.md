# Part Location Finder scanner — reversible rollout

## Behavior
- Camera button beside Part Number opens an opt-in camera scanner.
- Browser-native BarcodeDetector reads supported barcode / QR symbologies where available. No third-party script, extra server permission, or database migration.
- A recognized part number is normalized, inserted into the existing search input, and automatically submitted through the same `searchForPart` lookup as manual entry.
- Scanned URLs and unsupported non-part text are ignored. One scan initiates only one search; the camera stops when closed, completed or unmounted.
- Hardware USB/Bluetooth keyboard-wedge scanners remain supported when focused on the existing field and configured to send Enter after the scan.
- Unsupported browsers and denied camera permissions show a clear message; manual search is preserved.

## Review/acceptance checks
1. Run App CI build on the PR, test Chrome Android over HTTPS with camera permission granted.
2. Scan a plain part-number barcode, assert automatic search and location cards.
3. Scan a QR containing a plain part number; scan a QR containing a URL and confirm no search.
4. Cancel scanner, deny permission, and test unsupported browsers (manual entry must remain usable).
5. Verify desktop manual search, suggestions and keyboard Enter still work.
6. Check second scan and rapid searches do not display stale results; test hardware keyboard scanner Enter.

## Reversal
- Revert this feature PR to remove the camera control and scanner implementation.
- No backend, master data, RLS or database changes to undo.
- Camera access is only requested after clicking the scan button, and streams are stopped on exit.
