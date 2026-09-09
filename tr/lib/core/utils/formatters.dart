import 'package:intl/intl.dart';

String formatDuration(Duration d) {
  final h = d.inHours.toString().padLeft(2, '0');
  final m = (d.inMinutes % 60).toString().padLeft(2, '0');
  final s = (d.inSeconds % 60).toString().padLeft(2, '0');
  return '$h:$m:$s';
}

String formatShortDuration(Duration d) {
  if (d.inHours > 0) return '${d.inHours}h ${d.inMinutes % 60}m';
  return '${d.inMinutes}m';
}

String formatTime(DateTime t) => DateFormat('hh:mm a').format(t);

String formatDay(DateTime t) => DateFormat('EEEE, d MMMM').format(t);

String formatCurrency(num value) {
  return NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0)
      .format(value);
}

String formatCompactCurrency(num value) {
  if (value >= 10000000) return '₹${(value / 10000000).toStringAsFixed(2)} Cr';
  if (value >= 100000) return '₹${(value / 100000).toStringAsFixed(2)} L';
  if (value >= 1000) return '₹${(value / 1000).toStringAsFixed(1)}K';
  return '₹$value';
}
