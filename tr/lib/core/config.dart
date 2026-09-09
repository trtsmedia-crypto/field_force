/// Build-time configuration.
///
/// Override the API address without editing code:
///   flutter run --dart-define=API_URL=https://api.yourdomain.com/api/v1
///
/// 10.0.2.2 is how the Android emulator reaches the host machine's localhost.
/// On a real phone this must be your computer's LAN IP or a deployed URL.
class AppConfig {
  const AppConfig._();

  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  static String get uploadsOrigin =>
      apiUrl.replaceAll(RegExp(r'/api/v1/?$'), '');

  /// How often location points are pushed while on duty.
  static const trackingUploadInterval = Duration(minutes: 3);

  /// Minimum movement before a new point is recorded, in metres.
  static const trackingDistanceFilter = 25;
}
