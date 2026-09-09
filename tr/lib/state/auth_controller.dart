import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/errors/app_exception.dart';
import '../core/network/api_client.dart';
import '../core/storage/secure_store.dart';

class AuthUser {
  const AuthUser({
    required this.id,
    required this.username,
    required this.role,
    this.employeeId,
    this.name,
    this.designation,
    this.territory,
  });

  final String id;
  final String username;
  final String role;
  final String? employeeId;
  final String? name;
  final String? designation;
  final String? territory;

  String get displayName => name ?? username;

  factory AuthUser.fromJson(Map json) => AuthUser(
        id: json['id'] as String,
        username: json['username'] as String? ?? '',
        role: json['role'] as String? ?? 'FIELD_SALESMAN',
        employeeId: json['employee_id'] as String?,
        name: json['full_name'] as String?,
        designation: json['designation'] as String?,
        territory: json['territory'] as String?,
      );
}

enum AuthStatus { unknown, signedOut, mustChangePassword, needsFace, ready }

class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.faceRequired = true,
  });

  final AuthStatus status;
  final AuthUser? user;
  final bool faceRequired;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? faceRequired,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        faceRequired: faceRequired ?? this.faceRequired,
      );
}

class AuthController extends StateNotifier<AuthState> {
  AuthController() : super(const AuthState()) {
    _restore();
  }

  Future<void> _restore() async {
    final token = await SecureStore.accessToken;
    if (token == null) {
      state = const AuthState(status: AuthStatus.signedOut);
      return;
    }
    try {
      final me = await api.get('/auth/me');
      final user = AuthUser.fromJson(me as Map);
      await SecureStore.saveEmployee(user.employeeId, user.name);
      state = state.copyWith(user: user);
      await _resolveFaceStep();
    } catch (_) {
      await SecureStore.clear();
      state = const AuthState(status: AuthStatus.signedOut);
    }
  }

  /// After a valid session we still have to know whether the employee has
  /// registered a face, because duty cannot start without it.
  Future<void> _resolveFaceStep() async {
    try {
      final data = await api.get('/face/status') as Map;
      final enrolled = data['enrolled'] == true;
      final required = data['required'] == true;
      state = state.copyWith(
        faceRequired: required,
        status: (required && !enrolled)
            ? AuthStatus.needsFace
            : AuthStatus.ready,
      );
    } on AppException {
      // A lookup failure should not lock someone out of the whole app.
      state = state.copyWith(status: AuthStatus.ready, faceRequired: false);
    }
  }

  Future<void> signIn(String identifier, String password) async {
    final data = await api.post(
      '/auth/login',
      data: {
        'identifier': identifier,
        'password': password,
        'device': 'Field app',
      },
      skipAuth: true,
    ) as Map;

    await SecureStore.saveTokens(
      data['accessToken'] as String,
      data['refreshToken'] as String,
    );

    final userJson = data['user'] as Map;
    await SecureStore.saveEmployee(
      userJson['employeeId'] as String?,
      userJson['name'] as String?,
    );

    if (userJson['role'] != 'FIELD_SALESMAN') {
      await SecureStore.clear();
      throw AppException(
        'This is an office account. Use the admin website to sign in.',
      );
    }

    final me = await api.get('/auth/me');
    state = state.copyWith(user: AuthUser.fromJson(me as Map));

    if (data['mustChangePassword'] == true) {
      state = state.copyWith(status: AuthStatus.mustChangePassword);
      return;
    }
    await _resolveFaceStep();
  }

  Future<void> changePassword(String current, String next) async {
    await api.post('/auth/change-password', data: {
      'currentPassword': current,
      'newPassword': next,
    });
    // The server revokes every session on a password change, so we sign in
    // again silently rather than leaving a dead token in place.
    state = const AuthState(status: AuthStatus.signedOut);
    await SecureStore.clear();
  }

  Future<void> onFaceEnrolled() async {
    state = state.copyWith(status: AuthStatus.ready);
  }

  Future<void> signOut() async {
    final refresh = await SecureStore.refreshToken;
    await SecureStore.clear();
    state = const AuthState(status: AuthStatus.signedOut);
    if (refresh != null) {
      try {
        await api.post('/auth/logout',
            data: {'refreshToken': refresh}, skipAuth: true);
      } catch (_) {
        // Local sign-out already happened; a failed call does not undo it.
      }
    }
  }

  void forceSignedOut() {
    state = const AuthState(status: AuthStatus.signedOut);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) => AuthController());
