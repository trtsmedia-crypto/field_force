import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';

enum AppButtonTone { primary, duty, danger, neutral }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.tone = AppButtonTone.primary,
    this.expanded = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final AppButtonTone tone;
  final bool expanded;
  final bool loading;

  Color get _bg => switch (tone) {
        AppButtonTone.primary => AppColors.indigo,
        AppButtonTone.duty => AppColors.duty,
        AppButtonTone.danger => AppColors.danger,
        AppButtonTone.neutral => Colors.white,
      };

  Color get _fg =>
      tone == AppButtonTone.neutral ? AppColors.text : Colors.white;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: _fg),
          )
        else if (icon != null) ...[
          Icon(icon, size: 19, color: _fg),
        ],
        if (icon != null || loading) const SizedBox(width: 10),
        Text(
          label,
          style: TextStyle(
            color: _fg,
            fontSize: 15.5,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.2,
          ),
        ),
      ],
    );

    return SizedBox(
      width: expanded ? double.infinity : null,
      height: 54,
      child: Material(
        color: _bg,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: InkWell(
          onTap: loading ? null : onPressed,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: tone == AppButtonTone.neutral
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(color: AppColors.line),
                  )
                : null,
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
  }
}
