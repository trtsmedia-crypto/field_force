import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Tokens live in the Android Keystore / iOS Keychain, not in plain
/// preferences. Passwords are never stored at all.
class SecureStore {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _accessKey = 'ff_access_token';
  static const _refreshKey = 'ff_refresh_token';
  static const _employeeKey = 'ff_employee_id';
  static const _nameKey = 'ff_employee_name';

  static Future<String?> get accessToken => _storage.read(key: _accessKey);
  static Future<String?> get refreshToken => _storage.read(key: _refreshKey);
  static Future<String?> get employeeId => _storage.read(key: _employeeKey);
  static Future<String?> get employeeName => _storage.read(key: _nameKey);

  static Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  static Future<void> saveEmployee(String? id, String? name) async {
    if (id != null) await _storage.write(key: _employeeKey, value: id);
    if (name != null) await _storage.write(key: _nameKey, value: name);
  }

  static Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _employeeKey);
    await _storage.delete(key: _nameKey);
  }
}
