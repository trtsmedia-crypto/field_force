import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/status_chip.dart';
import '../../state/duty_controller.dart';

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(tickerProvider);
    final duty = ref.watch(dutyControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Attendance')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(dutyControllerProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen, 4, AppSpacing.screen, 32),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('Today',
                          style: Theme.of(context).textTheme.titleMedium),
                      const Spacer(),
                      switch (duty.status) {
                        DutyStatus.off => StatusChip.neutral('Not marked'),
                        DutyStatus.onDuty =>
                          StatusChip.success('On duty', dot: true),
                        DutyStatus.onBreak => StatusChip.warning('On break'),
                        DutyStatus.ended => StatusChip.info('Completed'),
                      },
                    ],
                  ),
                  const SizedBox(height: 18),
                  _Metric(
                    label: 'Duty started',
                    value: duty.startedAt == null
                        ? '—'
                        : formatTime(duty.startedAt!),
                  ),
                  _Metric(
                    label: 'Duty ended',
                    value:
                        duty.endedAt == null ? '—' : formatTime(duty.endedAt!),
                  ),
                  _Metric(
                    label: 'Working time',
                    value: formatDuration(duty.netWorking),
                  ),
                  _Metric(
                    label: 'Break time',
                    value: duty.breakDuration.inSeconds == 0
                        ? '—'
                        : formatShortDuration(duty.breakDuration),
                  ),
                  if (duty.address != null)
                    _Metric(label: 'Started at', value: duty.address!),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.indigoWash,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 18, color: AppColors.indigoDeep),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Your monthly attendance summary is visible to your '
                      'manager in the admin console. Ask them if you need a '
                      'copy for a particular month.',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: AppColors.indigoDeep,
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(fontSize: 14, color: AppColors.muted)),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                  fontSize: 14.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
