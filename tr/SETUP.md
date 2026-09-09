# FieldForce app — setup

## 1. Point the app at your API

The app talks to the backend. Which one depends on where you run it:

| Running on | API_URL |
|---|---|
| Android emulator, backend on same PC | `http://10.0.2.2:4000/api/v1` (default) |
| Real phone, backend on same wifi | `http://YOUR-PC-IP:4000/api/v1` |
| Live server | `https://api.yourdomain.com/api/v1` |

Find your PC's IP with `ipconfig` — the IPv4 address under your wifi adapter.

Run with a different address like this:

```
flutter run --dart-define=API_URL=http://192.168.1.5:4000/api/v1
```

In Android Studio: **Run → Edit Configurations → Additional run args**, and put
the same `--dart-define=...` there so you don't retype it.

The backend must have your address in `CORS_ORIGINS`, and on a real phone the
backend must be reachable — Windows Firewall usually blocks port 4000 until you
allow it.

## 2. Add the face model

Download `mobilefacenet.tflite` (about 5 MB) and put it at:

```
assets/models/mobilefacenet.tflite
```

See `assets/models/README.txt` for where to get it. Without this file
everything works except face registration and the duty face check, which show a
clear error instead.

## 3. Android permissions

Open `android/app/src/main/AndroidManifest.xml` and add these inside
`<manifest>`, above `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-feature android:name="android.hardware.camera" android:required="true"/>
```

Set the minimum SDK. In `android/app/build.gradle` (or `build.gradle.kts`),
inside `defaultConfig`:

```
minSdkVersion 26
```

ML Kit and the camera plugin both need 21 or higher; 26 avoids a set of older
device problems and covers Android 8 upwards.

**Plain HTTP during development.** Android blocks non-HTTPS traffic by default,
so testing against `http://10.0.2.2:4000` fails silently until you allow it.
Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">192.168.1.5</domain>
    </domain-config>
</network-security-config>
```

Then in `AndroidManifest.xml`, on the `<application>` tag:

```xml
android:networkSecurityConfig="@xml/network_security_config"
```

Remove this before release. Production must be HTTPS.

## 4. iOS permissions

In `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Used to confirm your identity when you start and end duty.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to record attendance and confirm customer visits during duty hours.</string>
```

In `ios/Podfile`, set the platform to at least:

```ruby
platform :ios, '13.0'
```

## 5. Run it

```
flutter clean
flutter pub get
flutter run
```

---

## First run, what to expect

1. **Splash** while the app checks for a stored session.
2. **Sign in** with the employee ID and password from the admin console.
3. **Set your password** — the temporary one only works once.
4. **Register your face** — one selfie, with a consent step.
5. **Home** — Start duty takes a selfie, gets a GPS fix, and calls the API.

If the employee has no assigned customers or visits yet, every screen shows an
empty state explaining that. That is correct behaviour on a fresh system, not a
bug.

---

## Common first-run problems

**"Cannot reach the server"** — the API address is wrong, the backend is not
running, or the firewall is blocking port 4000. Open `http://YOUR-IP:4000/health`
in the phone's browser; if that fails, the app cannot reach it either.

**Face screens error out** — `mobilefacenet.tflite` is missing from
`assets/models/`.

**Location returns nothing** — GPS is off, or permission was denied. Android
also needs the app in the foreground for the location stream to keep running;
continuous background tracking needs a foreground service, which is not built
yet.

**Build fails on a plugin** — plugin versions move quickly. Run
`flutter pub outdated`, then `flutter pub upgrade --major-versions`, and send me
the error if it persists.

---

## Not built yet

- **Background tracking.** Points are collected while the app is open. Once the
  phone locks or the app is backgrounded for a while, Android stops the stream.
  A foreground service with a persistent notification is needed for a full day
  of tracking, and is the next thing to build.
- **Liveness check.** A printed photo can currently pass the face check.
- **Offline queue for attendance and visits.** Location points survive being
  offline; duty start and check-in currently need a connection.
- Orders, expenses, leave and notifications are in the API but have no screens.
