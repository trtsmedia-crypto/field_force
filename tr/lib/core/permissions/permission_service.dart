import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

enum PermissionOutcome { granted, denied, permanentlyDenied, serviceOff }

/// Wraps the permission plugins so screens deal with one enum instead of
/// three different plugin result types.
class PermissionService {
  const PermissionService._();

  static Future<PermissionOutcome> requestLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return PermissionOutcome.serviceOff;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    return switch (permission) {
      LocationPermission.always ||
      LocationPermission.whileInUse =>
        PermissionOutcome.granted,
      LocationPermission.deniedForever => PermissionOutcome.permanentlyDenied,
      _ => PermissionOutcome.denied,
    };
  }

  static Future<PermissionOutcome> requestCamera() async {
    final status = await Permission.camera.request();
    if (status.isGranted) return PermissionOutcome.granted;
    if (status.isPermanentlyDenied) return PermissionOutcome.permanentlyDenied;
    return PermissionOutcome.denied;
  }

  static Future<void> openSettings() => openAppSettings();

  static Future<Position?> currentPosition() async {
    final outcome = await requestLocation();
    if (outcome != PermissionOutcome.granted) return null;
    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 20),

      );
    } catch (_) {
      // Falls back to the last known fix rather than blocking the user
      // outright when a fresh one is slow to arrive.
      return Geolocator.getLastKnownPosition();
    }
  }
}
