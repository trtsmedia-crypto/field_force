import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Shown while the stored session is checked against the server.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.indigo, AppColors.duty],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.explore_outlined,
                  color: Colors.white, size: 36),
            ),
            const SizedBox(height: 22),
            const Text(
              'FieldForce',
              style: TextStyle(
                color: Colors.white,
                fontSize: 27,
                fontWeight: FontWeight.w700,
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 24),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFF9AA3C7),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
