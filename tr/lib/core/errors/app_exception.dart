/// An error with a message that is safe to show the user.
///
/// Raw Dio and database errors never reach the UI; they are turned into one
/// of these first.
class AppException implements Exception {
  AppException(this.message, {this.code, this.statusCode});

  final String message;
  final String? code;
  final int? statusCode;

  bool get isNetwork => code == 'network';
  bool get isAuth => statusCode == 401;
  bool get isFaceMismatch => code == 'face_mismatch';

  @override
  String toString() => message;
}
