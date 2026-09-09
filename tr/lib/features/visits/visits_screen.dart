import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/app_button.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../state/data_providers.dart';
import '../../features/tracking/location_service.dart';
import '../dashboard/dashboard_screen.dart' show visitStatusChip;
import 'visit_checkout_sheet.dart';

class VisitsScreen extends ConsumerStatefulWidget {
  const VisitsScreen({super.key});

  @override
  ConsumerState<VisitsScreen> createState() => _VisitsScreenState();
}

class _VisitsScreenState extends ConsumerState<VisitsScreen> {
  int _filter = 0;
  static const _filters = ['All', 'Scheduled', 'Completed', 'Missed'];
  String? _busyVisitId;

  List<Visit> _visible(List<Visit> all) => switch (_filter) {
        1 => all.where((v) => v.status == VisitStatus.scheduled).toList(),
        2 => all.where((v) => v.status == VisitStatus.completed).toList(),
        3 => all.where((v) => v.status == VisitStatus.missed).toList(),
        _ => all,
      };

  Future<void> _checkIn(Visit visit) async {
    setState(() => _busyVisitId = visit.id);
    try {
      final fix = await LocationService.currentFix();
      if (fix == null) {
        _snack('Could not get your location. Turn on GPS and try again.');
        return;
      }
      await api.post('/visits/${visit.id}/check-in', data: {
        'latitude': fix.latitude,
        'longitude': fix.longitude,
      });
      ref.invalidate(visitsProvider);
      _snack('Checked in at ${visit.customerName}');
    } on AppException catch (e) {
      _snack(e.message);
    } finally {
      if (mounted) setState(() => _busyVisitId = null);
    }
  }

  Future<void> _checkOut(Visit visit) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => VisitCheckoutSheet(customerName: visit.customerName),
    );
    if (result == null || !mounted) return;

    setState(() => _busyVisitId = visit.id);
    try {
      await api.post('/visits/${visit.id}/check-out', data: result);
      ref.invalidate(visitsProvider);
      _snack('Visit completed');
    } on AppException catch (e) {
      _snack(e.message);
    } finally {
      if (mounted) setState(() => _busyVisitId = null);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final visitsAsync = ref.watch(visitsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Visits')),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final selected = i == _filter;
                return GestureDetector(
                  onTap: () => setState(() => _filter = i),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.ink : Colors.white,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: selected ? AppColors.ink : AppColors.line),
                    ),
                    child: Text(
                      _filters[i],
                      style: TextStyle(
                        color: selected ? Colors.white : AppColors.muted,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: AsyncView<List<Visit>>(
              value: visitsAsync,
              onRetry: () => ref.invalidate(visitsProvider),
              isEmpty: (data) => _visible(data).isEmpty,
              emptyTitle: 'No visits here',
              emptyMessage:
                  'Visits assigned to you for today will appear here. Pull down to refresh.',
              builder: (all) {
                final visits = _visible(all);
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(visitsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        AppSpacing.screen, 8, AppSpacing.screen, 90),
                    itemCount: visits.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) => _VisitCard(
                      visit: visits[i],
                      busy: _busyVisitId == visits[i].id,
                      onCheckIn: () => _checkIn(visits[i]),
                      onCheckOut: () => _checkOut(visits[i]),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _VisitCard extends StatelessWidget {
  const _VisitCard({
    required this.visit,
    required this.busy,
    required this.onCheckIn,
    required this.onCheckOut,
  });

  final Visit visit;
  final bool busy;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      visit.customerName,
                      style: const TextStyle(
                          fontSize: 15.5, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (visit.area != null) visit.area!,
                        if (visit.scheduledAt != null)
                          formatTime(visit.scheduledAt!),
                      ].join(' · '),
                      style: const TextStyle(
                          fontSize: 12.5, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              visitStatusChip(visit.status),
            ],
          ),
          if (visit.purpose != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.flag_outlined, size: 15, color: AppColors.muted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    visit.purpose!,
                    style:
                        const TextStyle(fontSize: 13, color: AppColors.muted),
                  ),
                ),
                if (visit.durationMinutes != null)
                  Text('${visit.durationMinutes} min',
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.muted)),
              ],
            ),
          ],
          if (visit.outstanding > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.account_balance_wallet_outlined,
                    size: 15, color: AppColors.danger),
                const SizedBox(width: 6),
                Text(
                  '${formatCurrency(visit.outstanding)} outstanding',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.danger,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
          if (visit.orderAmount > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.shopping_bag_outlined,
                    size: 15, color: AppColors.success),
                const SizedBox(width: 6),
                Text(
                  'Order booked ${formatCurrency(visit.orderAmount)}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.success,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
          if (visit.status == VisitStatus.scheduled) ...[
            const SizedBox(height: 16),
            AppButton(
              label: busy ? 'Checking in…' : 'Check in',
              icon: Icons.login_rounded,
              loading: busy,
              onPressed: busy ? null : onCheckIn,
            ),
            const SizedBox(height: 8),
            Text(
              'Check-in works within ${visit.geofenceRadius} m of the customer.',
              style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
            ),
          ] else if (visit.status == VisitStatus.started) ...[
            const SizedBox(height: 16),
            AppButton(
              label: busy ? 'Saving…' : 'Check out',
              icon: Icons.logout_rounded,
              tone: AppButtonTone.duty,
              loading: busy,
              onPressed: busy ? null : onCheckOut,
            ),
          ],
        ],
      ),
    );
  }
}
