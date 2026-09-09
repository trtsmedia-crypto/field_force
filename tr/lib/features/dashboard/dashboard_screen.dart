import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/section_header.dart';
import '../../shared/widgets/stat_tile.dart';
import '../../shared/widgets/status_chip.dart';
import '../../state/auth_controller.dart';
import '../../state/data_providers.dart';
import '../../state/duty_controller.dart';
import 'widgets/duty_card.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final visitsAsync = ref.watch(visitsProvider);
    final tasksAsync = ref.watch(tasksProvider);

    final visits = visitsAsync.valueOrNull ?? const <Visit>[];
    final tasks = tasksAsync.valueOrNull ?? const <FieldTask>[];
    final completed =
        visits.where((v) => v.status == VisitStatus.completed).length;
    final pending =
        visits.where((v) => v.status == VisitStatus.scheduled).length;
    final orders = visits.fold<double>(0, (sum, v) => sum + v.orderAmount);
    final openTasks =
        tasks.where((t) => t.status != TaskStatus.completed).length;
    final urgent = tasks
        .where((t) =>
            t.priority == TaskPriority.urgent &&
            t.status != TaskStatus.completed)
        .length;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(visitsProvider);
            ref.invalidate(tasksProvider);
            await ref.read(dutyControllerProvider.notifier).refresh();
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.screen, 8, AppSpacing.screen, 32),
            children: [
              _Greeting(name: user?.displayName, territory: user?.territory),
              const SizedBox(height: AppSpacing.xl),
              const DutyCard(),
              const SizedBox(height: AppSpacing.xxl),
              Row(
                children: [
                  Expanded(
                    child: StatTile(
                      value: '$completed/${visits.length}',
                      label: 'Visits done',
                      icon: Icons.check_circle_outline,
                      accent: AppColors.success,
                      footnote: pending == 0
                          ? 'All planned visits closed'
                          : '$pending still scheduled',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: StatTile(
                      value: formatCompactCurrency(orders),
                      label: 'Orders today',
                      icon: Icons.receipt_long_outlined,
                      accent: AppColors.indigo,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: StatTile(
                      value: '$openTasks',
                      label: 'Open tasks',
                      icon: Icons.task_alt_outlined,
                      accent: AppColors.warning,
                      footnote: urgent > 0 ? '$urgent urgent' : null,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: StatTile(
                      value: '${visits.where((v) => v.status == VisitStatus.missed).length}',
                      label: 'Missed visits',
                      icon: Icons.error_outline,
                      accent: AppColors.danger,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxl),
              SectionHeader(
                title: "Today's route",
                actionLabel: visits.isEmpty ? null : 'See all',
                onAction: () => context.go('/visits'),
              ),
              if (visitsAsync.isLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (visits.isEmpty)
                AppCard(
                  child: Row(
                    children: [
                      const Icon(Icons.event_available_outlined,
                          color: AppColors.muted),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'No visits planned for today.',
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                    ],
                  ),
                )
              else
                for (final visit in visits.take(3)) ...[
                  _VisitRow(visit: visit),
                  const SizedBox(height: AppSpacing.md),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({this.name, this.territory});

  final String? name;
  final String? territory;

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    final first = (name ?? '').split(' ').first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          first.isEmpty ? greeting : '$greeting, $first',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 3),
        Text(
          [territory, formatDay(DateTime.now())]
              .where((s) => s != null && s.isNotEmpty)
              .join(' · '),
          style: const TextStyle(color: AppColors.muted, fontSize: 13.5),
        ),
      ],
    );
  }
}

class _VisitRow extends StatelessWidget {
  const _VisitRow({required this.visit});

  final Visit visit;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.go('/visits'),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.indigoWash,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Text(
              visit.customerName.isEmpty
                  ? '?'
                  : visit.customerName.substring(0, 1).toUpperCase(),
              style: const TextStyle(
                color: AppColors.indigoDeep,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  visit.customerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    if (visit.scheduledAt != null) formatTime(visit.scheduledAt!),
                    if (visit.purpose != null) visit.purpose!,
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          visitStatusChip(visit.status),
        ],
      ),
    );
  }
}

StatusChip visitStatusChip(VisitStatus status) {
  return switch (status) {
    VisitStatus.completed => StatusChip.success('Completed'),
    VisitStatus.started => StatusChip.warning('In progress', dot: true),
    VisitStatus.scheduled => StatusChip.info('Scheduled'),
    VisitStatus.missed => StatusChip.danger('Missed'),
    VisitStatus.cancelled => StatusChip.neutral('Cancelled'),
  };
}
