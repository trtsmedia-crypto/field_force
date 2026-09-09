import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/duty_controller.dart';
import '../../face/face_capture_screen.dart';
import '../../face/face_service.dart';

/// The loudest element on the home screen: is duty running or not.
class DutyCard extends ConsumerStatefulWidget {
  const DutyCard({super.key});

  @override
  ConsumerState<DutyCard> createState() => _DutyCardState();
}

class _DutyCardState extends ConsumerState<DutyCard> {
  bool _working = false;

  Future<FaceResult?> _captureFace(String title, String instruction) {
    return Navigator.of(context).push<FaceResult>(
      MaterialPageRoute(
        builder: (_) => FaceCaptureScreen(title: title, instruction: instruction),
      ),
    );
  }

  Future<void> _start() async {
    final face = await _captureFace(
      'Start duty',
      'A quick selfie confirms this is you before your day is recorded.',
    );
    if (face == null || !mounted) return;

    setState(() => _working = true);
    try {
      await ref.read(dutyControllerProvider.notifier).startDuty(face);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Duty started. Have a good day.')),
        );
      }
    } catch (_) {
      // The controller already put the message into state; the card shows it.
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _end() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
        title: const Text('End duty for today?'),
        content: const Text(
          'Your working hours, distance and visits will be submitted. '
          'Location sharing stops immediately.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep working'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('End duty'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final face = await _captureFace(
      'End duty',
      'One more selfie to close the day.',
    );
    if (face == null || !mounted) return;

    setState(() => _working = true);
    try {
      await ref.read(dutyControllerProvider.notifier).endDuty(face);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Duty ended. Day summary submitted.')),
        );
      }
    } catch (_) {
      // Message is in state.
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(tickerProvider);
    final duty = ref.watch(dutyControllerProvider);
    final controller = ref.read(dutyControllerProvider.notifier);
    final running = duty.isOnDuty;
    final ended = duty.status == DutyStatus.ended;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.ink, Color(0xFF1B2244)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _StatusPill(status: duty.status),
              const Spacer(),
              if (duty.startedAt != null)
                Text(
                  'Since ${formatTime(duty.startedAt!)}',
                  style: const TextStyle(color: Color(0xFF9AA3C7), fontSize: 12.5),
                ),
            ],
          ),
          const SizedBox(height: 22),
          Text(
            duty.startedAt == null
                ? '00:00:00'
                : formatDuration(duty.netWorking),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 44,
              fontWeight: FontWeight.w700,
              letterSpacing: -2,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            ended
                ? 'Total worked today'
                : running
                    ? 'Net working time today'
                    : 'Start duty to begin your day',
            style: const TextStyle(color: Color(0xFF9AA3C7), fontSize: 13.5),
          ),
          if (duty.address != null) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Row(
                children: [
                  const Icon(Icons.place_outlined,
                      size: 17, color: Color(0xFF9AA3C7)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      duty.address!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Color(0xFFD7DBEC), fontSize: 13),
                    ),
                  ),
                  if (duty.accuracyMeters != null)
                    Text(
                      '±${duty.accuracyMeters} m',
                      style: const TextStyle(
                        color: AppColors.success,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                ],
              ),
            ),
          ],
          if (duty.error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withOpacity(0.15),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline,
                      size: 16, color: AppColors.danger),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      duty.error!,
                      style: const TextStyle(
                          color: Color(0xFFFFC9CB), fontSize: 12.5, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (duty.loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: CircularProgressIndicator(color: Colors.white),
              ),
            )
          else if (ended)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 15),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.08),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: const Text(
                'Duty completed for today',
                style: TextStyle(color: Color(0xFF9AA3C7), fontSize: 14.5),
              ),
            )
          else if (!running)
            _DutyAction(
              label: _working ? 'Starting…' : 'Start duty',
              icon: Icons.play_arrow_rounded,
              background: AppColors.duty,
              onTap: _working ? null : _start,
            )
          else
            Row(
              children: [
                Expanded(
                  child: _DutyAction(
                    label: duty.status == DutyStatus.onBreak
                        ? 'Resume'
                        : 'Break',
                    icon: duty.status == DutyStatus.onBreak
                        ? Icons.play_arrow_rounded
                        : Icons.pause_rounded,
                    background: Colors.white.withOpacity(0.12),
                    onTap: _working
                        ? null
                        : duty.status == DutyStatus.onBreak
                            ? controller.endBreak
                            : controller.startBreak,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _DutyAction(
                    label: 'End duty',
                    icon: Icons.stop_rounded,
                    background: AppColors.danger,
                    onTap: _working ? null : _end,
                  ),
                ),
              ],
            ),
          if (duty.breakDuration.inSeconds > 0) ...[
            const SizedBox(height: 12),
            Text(
              'Break taken: ${formatShortDuration(duty.breakDuration)}',
              style: const TextStyle(color: Color(0xFF9AA3C7), fontSize: 12.5),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final DutyStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      DutyStatus.off => ('Off duty', const Color(0xFF9AA3C7)),
      DutyStatus.onDuty => ('On duty', AppColors.duty),
      DutyStatus.onBreak => ('On break', AppColors.warning),
      DutyStatus.ended => ('Day complete', AppColors.success),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(
                color: color, fontSize: 12.5, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _DutyAction extends StatelessWidget {
  const _DutyAction({
    required this.label,
    required this.icon,
    required this.background,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color background;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: Material(
        color: onTap == null ? background.withOpacity(0.5) : background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
