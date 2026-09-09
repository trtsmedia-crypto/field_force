enum VisitStatus { scheduled, started, completed, cancelled, missed }

enum TaskPriority { low, medium, high, urgent }

enum TaskStatus { pending, inProgress, completed, cancelled }

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

int _toInt(dynamic v) =>
    v == null ? 0 : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);

DateTime? _toDate(dynamic v) =>
    v == null ? null : DateTime.tryParse('$v')?.toLocal();

class Customer {
  const Customer({
    required this.id,
    required this.code,
    required this.businessName,
    required this.contactName,
    required this.phone,
    required this.area,
    required this.city,
    required this.category,
    required this.outstanding,
    required this.geofenceRadius,
    this.latitude,
    this.longitude,
    this.lastVisit,
  });

  final String id;
  final String code;
  final String businessName;
  final String? contactName;
  final String? phone;
  final String? area;
  final String? city;
  final String? category;
  final double outstanding;
  final int geofenceRadius;
  final double? latitude;
  final double? longitude;
  final DateTime? lastVisit;

  String get initials {
    final parts = businessName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final one = parts.first;
      return (one.length >= 2 ? one.substring(0, 2) : one).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  factory Customer.fromJson(Map json) => Customer(
        id: json['id'] as String,
        code: json['customer_code'] as String? ?? '',
        businessName: json['business_name'] as String? ?? 'Unnamed',
        contactName: json['contact_name'] as String?,
        phone: json['phone'] as String?,
        area: json['area'] as String?,
        city: json['city'] as String?,
        category: json['category'] as String?,
        outstanding: _toDouble(json['outstanding']),
        geofenceRadius: _toInt(json['geofence_radius']) == 0
            ? 100
            : _toInt(json['geofence_radius']),
        latitude: json['latitude'] == null ? null : _toDouble(json['latitude']),
        longitude:
            json['longitude'] == null ? null : _toDouble(json['longitude']),
        lastVisit: _toDate(json['last_visit']),
      );
}

class Visit {
  const Visit({
    required this.id,
    required this.code,
    required this.customerId,
    required this.customerName,
    required this.status,
    this.area,
    this.purpose,
    this.scheduledAt,
    this.checkInAt,
    this.durationMinutes,
    this.orderAmount = 0,
    this.latitude,
    this.longitude,
    this.geofenceRadius = 100,
    this.outstanding = 0,
  });

  final String id;
  final String code;
  final String customerId;
  final String customerName;
  final VisitStatus status;
  final String? area;
  final String? purpose;
  final DateTime? scheduledAt;
  final DateTime? checkInAt;
  final int? durationMinutes;
  final double orderAmount;
  final double? latitude;
  final double? longitude;
  final int geofenceRadius;
  final double outstanding;

  factory Visit.fromJson(Map json) => Visit(
        id: json['id'] as String,
        code: json['visit_code'] as String? ?? '',
        customerId: json['customer_id'] as String? ?? '',
        customerName: json['business_name'] as String? ?? 'Customer',
        area: json['area'] as String?,
        purpose: json['purpose'] as String?,
        status: switch (json['status']) {
          'started' => VisitStatus.started,
          'completed' => VisitStatus.completed,
          'cancelled' => VisitStatus.cancelled,
          'missed' => VisitStatus.missed,
          _ => VisitStatus.scheduled,
        },
        scheduledAt: _toDate(json['scheduled_at']),
        checkInAt: _toDate(json['check_in_at']),
        durationMinutes: json['duration_minutes'] == null
            ? null
            : _toInt(json['duration_minutes']),
        orderAmount: _toDouble(json['order_amount']),
        latitude: json['latitude'] == null ? null : _toDouble(json['latitude']),
        longitude:
            json['longitude'] == null ? null : _toDouble(json['longitude']),
        geofenceRadius: _toInt(json['geofence_radius']) == 0
            ? 100
            : _toInt(json['geofence_radius']),
        outstanding: _toDouble(json['outstanding']),
      );
}

class FieldTask {
  const FieldTask({
    required this.id,
    required this.title,
    required this.priority,
    required this.status,
    this.description,
    this.customerName,
    this.dueAt,
  });

  final String id;
  final String title;
  final String? description;
  final TaskPriority priority;
  final TaskStatus status;
  final String? customerName;
  final DateTime? dueAt;

  factory FieldTask.fromJson(Map json) => FieldTask(
        id: json['id'] as String,
        title: json['title'] as String? ?? 'Task',
        description: json['description'] as String?,
        customerName: json['customer_name'] as String?,
        priority: switch (json['priority']) {
          'urgent' => TaskPriority.urgent,
          'high' => TaskPriority.high,
          'low' => TaskPriority.low,
          _ => TaskPriority.medium,
        },
        status: switch (json['status']) {
          'in_progress' => TaskStatus.inProgress,
          'completed' => TaskStatus.completed,
          'cancelled' => TaskStatus.cancelled,
          _ => TaskStatus.pending,
        },
        dueAt: _toDate(json['due_at']),
      );
}
