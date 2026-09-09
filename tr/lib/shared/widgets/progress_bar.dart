import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class ProgressBar extends StatelessWidget {
  const ProgressBar({
    super.key,
    required this.ratio,
    this.color = AppColors.indigo,
    this.height = 8,
  });

  final double ratio;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: ratio,
        minHeight: height,
        backgroundColor: const Color(0xFFEDEFF5),
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );
  }
}
