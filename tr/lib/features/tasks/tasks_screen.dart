import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/status_chip.dart';
import '../../state/data_providers.dart';

class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  String? _busyId;

  Future<void> _update(FieldTask task, String status) async {
    setState(() => _busyId = task.id);
    try {
      await api.patch('/tasks/${task.id}/status', data: {'status': status});
      ref.invalidate(tasksProvider);
    } on AppException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(tasksProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      body: AsyncView<List<FieldTask>>(
        value: async,
        onRetry: () => ref.invalidate(tasksProvider),
        isEmpty: (data) => data.isEmpty,
        emptyTitle: 'No tasks assigned',
        emptyMessage:
            'Work assigned to you by your manager will show up here.',
        builder: (tasks) {
          final open =
              tasks.where((t) => t.status != TaskStatus.completed).toList();
          final done =
              tasks.where((t) => t.status == TaskStatus.completed).toList();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(tasksProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.screen, 4, AppSpacing.screen, 32),
              children: [
                Text(
                  '${open.length} open · ${done.length} completed',
                  style: const TextStyle(color: AppColors.muted, fontSize: 13.5),
                ),
                const SizedBox(height: 16),
                for (final task in [...open, ...done]) ...[
                  _TaskCard(
                    task: task,
                    busy: _busyId == task.id,
                    onStart: () => _update(task, 'in_progress'),
                    onComplete: () => _update(task, 'completed'),
                  ),
                  const SizedBox(height: 12),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.busy,
    required this.onStart,
    required this.onComplete,
  });

  final FieldTask task;
  final bool busy;
  final VoidCallback onStart;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    final completed = task.status == TaskStatus.completed;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 4,
                height: 38,
                margin: const EdgeInsets.only(right: 13, top: 2),
                decoration: BoxDecoration(
                  color: _priorityColor(task.priority),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w600,
                        color: completed ? AppColors.muted : AppColors.text,
                        decoration:
                            completed ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    if (task.description != null) ...[
                      const SizedBox(height: 5),
                      Text(
                        task.description!,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.muted, height: 1.45),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _priorityChip(task.priority),
              const SizedBox(width: 8),
              if (completed)
                StatusChip.success('Completed')
              else if (task.dueAt != null)
                StatusChip.neutral('Due ${formatTime(task.dueAt!)}'),
              const Spacer(),
              if (!completed)
                busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : TextButton(
                        onPressed: task.status == TaskStatus.inProgress
                            ? onComplete
                            : onStart,
                        child: Text(
                          task.status == TaskStatus.inProgress
                              ? 'Complete'
                              : 'Start',
                        ),
                      ),
            ],
          ),
          if (task.customerName != null) ...[
            const SizedBox(height: 6),
            Text(
              task.customerName!,
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ],
        ],
      ),
    );
  }

  Color _priorityColor(TaskPriority p) => switch (p) {
        TaskPriority.urgent => AppColors.danger,
        TaskPriority.high => AppColors.duty,
        TaskPriority.medium => AppColors.warning,
        TaskPriority.low => AppColors.muted,
      };

  StatusChip _priorityChip(TaskPriority p) => switch (p) {
        TaskPriority.urgent => StatusChip.danger('Urgent'),
        TaskPriority.high => StatusChip.warning('High'),
        TaskPriority.medium => StatusChip.info('Medium'),
        TaskPriority.low => StatusChip.neutral('Low'),
      };
}
