import 'dart:async';

import 'package:dio/dio.dart';

import '../config.dart';
import '../errors/app_exception.dart';
import '../storage/secure_store.dart';

/// Fired when the refresh token is no longer valid and the user must sign in
/// again. The router listens for this.
final StreamController<void> sessionExpiredStream =
    StreamController<void>.broadcast();

class ApiClient {
  ApiClient._() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 60),
        headers: {'Content-Type': 'application/json'},
        // We inspect the envelope ourselves, so let all statuses through.
        validateStatus: (_) => true,
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['skipAuth'] != true) {
            final token = await SecureStore.accessToken;
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._();
  late final Dio _dio;

  Completer<bool>? _refreshing;

  /// Refreshes once even when several calls fail at the same moment.
  Future<bool> _refresh() async {
    if (_refreshing != null) return _refreshing!.future;

    final completer = Completer<bool>();
    _refreshing = completer;

    try {
      final refreshToken = await SecureStore.refreshToken;
      if (refreshToken == null) {
        completer.complete(false);
        return false;
      }

      final res = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(extra: {'skipAuth': true}),
      );

      if (res.statusCode == 200 && res.data?['success'] == true) {
        await SecureStore.saveTokens(
          res.data['data']['accessToken'] as String,
          res.data['data']['refreshToken'] as String,
        );
        completer.complete(true);
        return true;
      }
      completer.complete(false);
      return false;
    } catch (_) {
      completer.complete(false);
      return false;
    } finally {
      _refreshing = null;
    }
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool skipAuth = false,
    bool allowRetry = true,
  }) async {
    Response res;
    try {
      res = await _dio.request(
        path,
        data: data,
        queryParameters: query,
        options: Options(method: method, extra: {'skipAuth': skipAuth}),
      );
    } on DioException catch (e) {
      throw AppException(
        e.type == DioExceptionType.connectionError ||
                e.type == DioExceptionType.connectionTimeout
            ? 'Cannot reach the server. Check your internet and try again.'
            : 'The request took too long. Try again.',
        code: 'network',
      );
    }

    if (res.statusCode == 401 && !skipAuth && allowRetry) {
      final refreshed = await _refresh();
      if (refreshed) {
        return request(
          path,
          method: method,
          data: data,
          query: query,
          allowRetry: false,
        );
      }
      await SecureStore.clear();
      sessionExpiredStream.add(null);
      throw AppException(
        'Your session has expired. Please sign in again.',
        statusCode: 401,
      );
    }

    final body = res.data;
    if (body is! Map) {
      throw AppException('The server sent an unexpected response.');
    }

    if (body['success'] == true) return body['data'];

    final error = body['error'];
    throw AppException(
      (error?['message'] as String?) ?? 'Something went wrong. Please try again.',
      code: error?['code'] as String?,
      statusCode: res.statusCode,
    );
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      request(path, query: query);

  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? data,
    bool skipAuth = false,
  }) =>
      request(path, method: 'POST', data: data, skipAuth: skipAuth);

  Future<dynamic> patch(String path, {Map<String, dynamic>? data}) =>
      request(path, method: 'PATCH', data: data);
}

final api = ApiClient.instance;
