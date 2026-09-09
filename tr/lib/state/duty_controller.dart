import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../features/face/face_service.dart';
import '../features/tracking/location_service.dart';

enum DutyStatus { off, onDuty, onBreak, ended }

class DutyState {
  const DutyState({
    this.status = DutyStatus.off,
    this.startedAt,
    this.endedAt,
    this.breakStartedAt,
    this.accumulatedBreak = Duration.zero,
    this.address,
    this.accuracyMeters,
    this.loading = true,
    this.error,
  });

  final DutyStatus status;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final DateTime? breakStartedAt;
  final Duration accumulatedBreak;
  final String? address;
  final int? accuracyMeters;
  final bool loading;
  final String? error;

  bool get isOnDuty =>
      status == DutyStatus.onDuty || status == DutyStatus.onBreak;

  Duration get elapsed =>
      startedAt == null ? Duration.zero : DateTime.now().difference(startedAt!);

  Duration get breakDuration {
    if (breakStartedAt == null) return accumulatedBreak;
    return accumulatedBreak + DateTime.now().difference(breakStartedAt!);
  }

  Duration get netWorking {
    if (startedAt == null) return Duration.zero;
    final end = endedAt ?? DateTime.now();
    final net = end.difference(startedAt!) - breakDuration;
    return net.isNegative ? Duration.zero : net;
  }

  DutyState copyWith({
    DutyStatus? status,
    DateTime? startedAt,
    DateTime? endedAt,
    DateTime? breakStartedAt,
    bool clearBreakStart = false,
    bool clearError = false,
    Duration? accumulatedBreak,
    String? address,
    int? accuracyMeters,
    bool? loading,
    String? error,
  }) =>
      DutyState(
        status: status ?? this.status,
        startedAt: startedAt ?? this.startedAt,
        endedAt: endedAt ?? this.endedAt,
        breakStartedAt: clearBreakStart ? null : (breakStartedAt ?? this.breakStartedAt),
        accumulatedBreak: accumulatedBreak ?? this.accumulatedBreak,
        address: address ?? this.address,
        accuracyMeters: accuracyMeters ?? this.accuracyMeters,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class DutyController extends StateNotifier<DutyState> {
  DutyController(this._ref) : super(const DutyState()) {
    refresh();
  }

  final Ref _ref;

  /// Reads today's record from the server, so the app shows the truth even
  /// after a reinstall or a phone swap.
  Future<void> refresh() async {
    try {
      final data = await api.get('/attendance/today');
      if (data == null) {
        state = const DutyState(status: DutyStatus.off, loading: false);
        return;
      }
      final map = data as Map;
      final start = _parse(map['start_time']);
      final end = _parse(map['end_time']);
      final openBreak = map['open_break_id'] != null;

      state = DutyState(
        status: end != null
            ? DutyStatus.ended
            : start == null
                ? DutyStatus.off
                : openBreak
                    ? DutyStatus.onBreak
                    : DutyStatus.onDuty,
        startedAt: start,
        endedAt: end,
        breakStartedAt: openBreak ? DateTime.now() : null,
        accumulatedBreak:
            Duration(seconds: (map['total_break_seconds'] as num?)?.toInt() ?? 0),
        address: map['start_address'] as String?,
        accuracyMeters: (map['gps_accuracy'] as num?)?.toInt(),
        loading: false,
      );

      if (state.status == DutyStatus.onDuty) {
        _ref.read(locationServiceProvider).start();
      }
    } on AppException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
    }
  }

  static DateTime? _parse(dynamic value) =>
      value == null ? null : DateTime.tryParse(value as String)?.toLocal();

  /// Starts duty. The face result and a GPS fix are both required by the
  /// server, so we gather them before calling.
  Future<void> startDuty(FaceResult? face) async {
    state = state.copyWith(loading: true, clearError: true);

    final fix = await LocationService.currentFix();
    if (fix == null) {
      state = state.copyWith(
        loading: false,
        error: 'Could not get your location. Turn on GPS and try again.',
      );
      return;
    }

    try {
      final data = await api.post('/attendance/start', data: {
        'latitude': fix.latitude,
        'longitude': fix.longitude,
        'accuracy': fix.accuracy,
        'address': fix.address,
        'device': 'Field app',
        if (face != null) 'faceEmbedding': face.embedding,
        if (face != null) 'selfie': face.jpegBase64,
      }) as Map;

      state = DutyState(
        status: DutyStatus.onDuty,
        startedAt: _parse(data['start_time']) ?? DateTime.now(),
        address: fix.address,
        accuracyMeters: fix.accuracy.round(),
        loading: false,
      );

      _ref.read(locationServiceProvider).start();
    } on AppException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
      rethrow;
    }
  }

  Future<void> endDuty(FaceResult? face) async {
    state = state.copyWith(loading: true, clearError: true);

    final fix = await LocationService.currentFix();

    try {
      // Push whatever is still queued before the server closes the day.
      await _ref.read(locationServiceProvider).flush();

      final data = await api.post('/attendance/end', data: {
        if (fix != null) 'latitude': fix.latitude,
        if (fix != null) 'longitude': fix.longitude,
        if (fix != null) 'address': fix.address,
        'device': 'Field app',
        if (face != null) 'faceEmbedding': face.embedding,
        if (face != null) 'selfie': face.jpegBase64,
      }) as Map;

      _ref.read(locationServiceProvider).stop();

      state = state.copyWith(
        status: DutyStatus.ended,
        endedAt: _parse(data['end_time']) ?? DateTime.now(),
        loading: false,
        clearBreakStart: true,
      );
    } on AppException catch (e) {
      state = state.copyWith(loading: false, error: e.message);
      rethrow;
    }
  }

  Future<void> startBreak() async {
    try {
      await api.post('/attendance/break/start');
      state = state.copyWith(
        status: DutyStatus.onBreak,
        breakStartedAt: DateTime.now(),
        clearError: true,
      );
    } on AppException catch (e) {
      state = state.copyWith(error: e.message);
    }
  }

  Future<void> endBreak() async {
    try {
      await api.post('/attendance/break/end');
      final extra = state.breakStartedAt == null
          ? Duration.zero
          : DateTime.now().difference(state.breakStartedAt!);
      state = state.copyWith(
        status: DutyStatus.onDuty,
        accumulatedBreak: state.accumulatedBreak + extra,
        clearBreakStart: true,
        clearError: true,
      );
    } on AppException catch (e) {
      state = state.copyWith(error: e.message);
    }
  }
}

final dutyControllerProvider =
    StateNotifierProvider<DutyController, DutyState>(DutyController.new);

/// Ticks once a second so the on-screen timer stays live.
final tickerProvider = StreamProvider.autoDispose<int>((ref) {
  return Stream<int>.periodic(const Duration(seconds: 1), (i) => i);
});
