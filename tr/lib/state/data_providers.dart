import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../shared/models/models.dart';

/// Today's visits for the signed-in employee.
final visitsProvider = FutureProvider.autoDispose<List<Visit>>((ref) async {
  final data = await api.get('/visits') as List;
  return data.map((e) => Visit.fromJson(e as Map)).toList();
});

/// Customers assigned to this employee, nearest first once we know where
/// they are.
final customersProvider =
    FutureProvider.autoDispose.family<List<Customer>, String>((ref, search) async {
  final data = await api.get('/customers',
      query: search.isEmpty ? null : {'search': search}) as List;
  return data.map((e) => Customer.fromJson(e as Map)).toList();
});

final tasksProvider = FutureProvider.autoDispose<List<FieldTask>>((ref) async {
  final data = await api.get('/tasks') as List;
  return data.map((e) => FieldTask.fromJson(e as Map)).toList();
});

final faceStatusProvider = FutureProvider.autoDispose<Map>((ref) async {
  return await api.get('/face/status') as Map;
});
