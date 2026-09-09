import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/theme/app_colors.dart';
import 'app_button.dart';
import 'empty_state.dart';

/// Renders loading, error and empty consistently so no screen invents its own.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.builder,
    required this.onRetry,
    this.emptyTitle,
    this.emptyMessage,
    this.isEmpty,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;
  final String? emptyTitle;
  final String? emptyMessage;
  final bool Function(T data)? isEmpty;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      ),
      error: (err, _) {
        final message = err is AppException
            ? err.message
            : 'Could not load this. Please try again.';
        return Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AppColors.dangerWash,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.cloud_off_outlined,
                      color: AppColors.danger, size: 26),
                ),
                const SizedBox(height: 18),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 14.5, color: AppColors.muted, height: 1.5),
                ),
                const SizedBox(height: 20),
                AppButton(
                  label: 'Try again',
                  icon: Icons.refresh_rounded,
                  expanded: false,
                  onPressed: onRetry,
                ),
              ],
            ),
          ),
        );
      },
      data: (data) {
        if (isEmpty?.call(data) == true) {
          return EmptyState(
            icon: Icons.inbox_outlined,
            title: emptyTitle ?? 'Nothing here yet',
            message: emptyMessage ?? 'This will fill up as your day goes on.',
          );
        }
        return builder(data);
      },
    );
  }
}
