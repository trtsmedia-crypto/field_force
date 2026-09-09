import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'app_card.dart';

class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
    required this.accent,
    this.footnote,
  });

  final String value;
  final String label;
  final IconData icon;
  final Color accent;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: accent),
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: const TextStyle(
              fontSize: 23,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.8,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
          if (footnote != null) ...[
            const SizedBox(height: 6),
            Text(
              footnote!,
              style: TextStyle(
                fontSize: 11.5,
                color: accent,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
