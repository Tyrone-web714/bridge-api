# Pilot Mobile Readiness

Status: PARTIAL, pilot blocking.

Repository evidence supports a mature mobile foundation:

- Preview and production mobile profiles target the hosted HTTPS backend.
- Mobile configuration rejects non-HTTPS API base URLs for standalone preview and production builds.
- Offline stop operation queueing, cached assigned routes, retry handling, and startup/foreground sync paths exist.
- Route event queueing, hazard fetch/report paths, media capture support, secure storage, location, and map integration exist.

Unverified for pilot:

- Current signed preview or production APK artifact.
- Install and login on owner-approved pilot devices.
- Physical offline/reconnect/restart replay.
- Duplicate prevention for stop completion and media/notes replay.
- GPS loss, permission denial, battery/background behavior, and long-route behavior.
- Multi-driver concurrency with supervisor visibility.
- Device support process and log capture.

Recommended initial pilot mobile scope:

- One Organization.
- One depot.
- Two to three drivers.
- Three to five routes per day.
- Route assignment, safe route display, hazard warnings, stop completion, notes/photos only after media path validation, and supervisor visibility.

Exit criteria:

- Pilot APK hash/build identifier, backend target, install evidence, device list, and test accounts are recorded.
- Offline replay passes on every supported device class.
- Mobile tenant and driver identity are preserved through logout, restart, offline queueing, and reconnect.
