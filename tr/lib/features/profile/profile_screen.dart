import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/widgets/app_card.dart';
import '../../state/auth_controller.dart';
import '../../state/data_providers.dart';
import '../../features/tracking/location_service.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final faceAsync = ref.watch(faceStatusProvider);
    final name = user?.displayName ?? '';
    final initials = name.isEmpty
        ? '?'
        : name
            .split(' ')
            .take(2)
            .map((p) => p.isEmpty ? '' : p[0])
            .join()
            .toUpperCase();

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.screen, 4, AppSpacing.screen, 32),
        children: [
          AppCard(
            child: Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.indigo, AppColors.indigoDeep],
                    ),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Text(
                    initials,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name.isEmpty ? 'Employee' : name,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 3),
                      Text(
                        [user?.designation, user?.username]
                            .where((s) => s != null && s.isNotEmpty)
                            .join(' · '),
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.muted),
                      ),
                      if (user?.territory != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          'Territory: ${user!.territory}',
                          style: const TextStyle(
                              fontSize: 12.5, color: AppColors.muted),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          faceAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (face) => AppCard(
              child: Row(
                children: [
                  Icon(
                    face['enrolled'] == true
                        ? Icons.verified_user_outlined
                        : Icons.gpp_maybe_outlined,
                    color: face['enrolled'] == true
                        ? AppColors.success
                        : AppColors.warning,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          face['enrolled'] == true
                              ? 'Face registered'
                              : 'Face not registered',
                          style: const TextStyle(
                              fontSize: 14.5, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          face['enrolled'] == true
                              ? 'Used to confirm your attendance at duty start and end.'
                              : 'Ask your manager if you need this reset.',
                          style: const TextStyle(
                              fontSize: 12.5,
                              color: AppColors.muted,
                              height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _Tile(
                  icon: Icons.privacy_tip_outlined,
                  label: 'How your location is used',
                  onTap: () => _showPrivacy(context),
                ),
                _Tile(
                  icon: Icons.sync_outlined,
                  label: 'Sync pending data',
                  onTap: () async {
                    await ref.read(locationServiceProvider).flush();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Sync attempted.')),
                      );
                    }
                  },
                ),
                _Tile(
                  icon: Icons.help_outline,
                  label: 'Help and support',
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Contact your admin for support.'),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          TextButton.icon(
            onPressed: () => _confirmSignOut(context, ref),
            icon: const Icon(Icons.logout_rounded,
                size: 19, color: AppColors.danger),
            label: const Text('Sign out',
                style: TextStyle(color: AppColors.danger)),
          ),
          const SizedBox(height: 8),
          const Center(
            child: Text(
              'FieldForce v1.0.0',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'Any location points not yet uploaded stay on this device until you '
          'sign in again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(authControllerProvider.notifier).signOut();
    }
  }

  void _showPrivacy(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.screen, 0, AppSpacing.screen, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('How your data is used',
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 14),
            const Text(
              'Location is recorded only between Start duty and End duty, and '
              'only if your admin has enabled tracking on your profile. It '
              'stops the moment you end duty.\n\n'
              'It is used to confirm attendance, verify customer check-ins, and '
              'calculate the distance you travel for expense claims.\n\n'
              'Your face is stored as a pattern of numbers, not a photo album. '
              'The camera is used at duty start and duty end only.',
              style: TextStyle(height: 1.55, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Icon(icon, size: 21, color: AppColors.muted),
      title: Text(label, style: const TextStyle(fontSize: 14.5)),
      trailing: const Icon(Icons.chevron_right_rounded,
          size: 20, color: AppColors.muted),
    );
  }
}
