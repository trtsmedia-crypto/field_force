import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.color,
    required this.background,
    this.dot = false,
  });

  final String label;
  final Color color;
  final Color background;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(dot ? 8 : 10, 5, 10, 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
  }

  factory StatusChip.success(String label, {bool dot = false}) => StatusChip(
        label: label,
        color: AppColors.success,
        background: AppColors.successWash,
        dot: dot,
      );

  factory StatusChip.warning(String label, {bool dot = false}) => StatusChip(
        label: label,
        color: const Color(0xFFB07908),
        background: AppColors.warningWash,
        dot: dot,
      );

  factory StatusChip.danger(String label, {bool dot = false}) => StatusChip(
        label: label,
        color: AppColors.danger,
        background: AppColors.dangerWash,
        dot: dot,
      );

  factory StatusChip.info(String label, {bool dot = false}) => StatusChip(
        label: label,
        color: AppColors.indigoDeep,
        background: AppColors.indigoWash,
        dot: dot,
      );

  factory StatusChip.neutral(String label, {bool dot = false}) => StatusChip(
        label: label,
        color: AppColors.muted,
        background: const Color(0xFFF0F1F6),
        dot: dot,
      );
}
