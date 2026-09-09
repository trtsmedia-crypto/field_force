import 'dart:async';
import 'dart:convert';

import 'package:battery_plus/battery_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config.dart';
import '../../core/errors/app_exception.dart';
import '../../core/network/api_client.dart';

class LocationFix {
  const LocationFix({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.address,
  });

  final double latitude;
  final double longitude;
  final double accuracy;
  final String? address;
}

/// Collects GPS points while duty is running and uploads them in batches.
///
/// Batching is the whole point: sending a point per second would drain the
/// battery before lunch. Points are held on the device and pushed every few
/// minutes, and they survive being offline.
class LocationService {
  LocationService();

  static const _queueKey = 'ff_pending_points';

  StreamSubscription<Position>? _subscription;
  Timer? _uploadTimer;
  final _battery = Battery();
  final List<Map<String, dynamic>> _buffer = [];

  bool get isRunning => _subscription != null;

  Future<void> start() async {
    if (_subscription != null) return;

    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return;
    }

    _subscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: AppConfig.trackingDistanceFilter,
      ),
    ).listen(_onPosition, onError: (_) {});

    _uploadTimer = Timer.periodic(
      AppConfig.trackingUploadInterval,
      (_) => flush(),
    );

    // Anything left over from a previous session goes out first.
    await flush();
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
    _uploadTimer?.cancel();
    _uploadTimer = null;
  }

  Future<void> _onPosition(Position position) async {
    int? level;
    try {
      level = await _battery.batteryLevel;
    } catch (_) {
      level = null;
    }

    _buffer.add({
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracy': position.accuracy,
      'speed': position.speed * 3.6, // m/s to km/h
      'heading': position.heading,
      if (level != null) 'battery': level,
      'isMock': position.isMocked,
      'recordedAt': position.timestamp.toUtc().toIso8601String(),
    });

    if (_buffer.length >= 60) await flush();
  }

  /// Sends everything buffered. On failure the points are written to disk so
  /// a lost signal does not lose the route.
  Future<void> flush() async {
    final pending = await _loadQueue();
    final all = [...pending, ..._buffer];
    if (all.isEmpty) return;

    _buffer.clear();
    await _saveQueue([]);

    // The API accepts 200 at a time.
    for (var i = 0; i < all.length; i += 200) {
      final chunk = all.sublist(i, (i + 200).clamp(0, all.length));
      try {
        await api.post('/tracking/points', data: {'points': chunk});
      } on AppException {
        final remaining = all.sublist(i);
        await _saveQueue(remaining);
        return;
      }
    }
  }

  Future<List<Map<String, dynamic>>> _loadQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<void> _saveQueue(List<Map<String, dynamic>> points) async {
    final prefs = await SharedPreferences.getInstance();
    // Keep the newest 2000; beyond that the oldest points matter least.
    final trimmed =
        points.length > 2000 ? points.sublist(points.length - 2000) : points;
    await prefs.setString(_queueKey, jsonEncode(trimmed));
  }

  Future<int> pendingCount() async => (await _loadQueue()).length + _buffer.length;

  /// A single fix with a readable address, used for duty start/end.
  static Future<LocationFix?> currentFix() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 20),
      );

      String? address;
      try {
        final places = await placemarkFromCoordinates(
          position.latitude,
          position.longitude,
        );
        if (places.isNotEmpty) {
          final p = places.first;
          address = [p.subLocality, p.locality, p.administrativeArea]
              .where((s) => s != null && s.isNotEmpty)
              .join(', ');
        }
      } catch (_) {
        // Geocoding is a nicety; a missing address never blocks duty.
      }

      return LocationFix(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        address: address,
      );
    } catch (_) {
      return null;
    }
  }
}

final locationServiceProvider = Provider<LocationService>((ref) {
  final service = LocationService();
  ref.onDispose(service.stop);
  return service;
});
