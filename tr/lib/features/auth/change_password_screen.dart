import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/widgets/app_button.dart';
import '../../state/auth_controller.dart';

/// Shown when the account is still on the password the admin created.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _done;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    if (_next.text.length < 8) {
      setState(() => _error = 'New password must be at least 8 characters.');
      return;
    }
    if (_next.text != _confirm.text) {
      setState(() => _error = 'The two new passwords do not match.');
      return;
    }
    if (_next.text == _current.text) {
      setState(() => _error = 'Choose a password different from the old one.');
      return;
    }

    setState(() => _loading = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .changePassword(_current.text, _next.text);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _done = 'Password changed. Sign in with your new password.';
      });
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set your password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen, 8, AppSpacing.screen, AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Choose your own password',
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              const Text(
                'The password your admin gave you is temporary. Pick one only '
                'you know — it protects your attendance and your customers.',
                style: TextStyle(
                    color: AppColors.muted, fontSize: 14.5, height: 1.5),
              ),
              const SizedBox(height: 28),
              if (_done != null)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.successWash,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: Text(_done!,
                      style: const TextStyle(
                          color: AppColors.success, height: 1.45)),
                )
              else ...[
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.dangerWash,
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    child: Text(_error!,
                        style: const TextStyle(
                            color: AppColors.danger,
                            fontSize: 13.5,
                            height: 1.4)),
                  ),
                  const SizedBox(height: 20),
                ],
                _Field(controller: _current, label: 'Temporary password'),
                _Field(controller: _next, label: 'New password'),
                _Field(controller: _confirm, label: 'Confirm new password'),
                const SizedBox(height: 12),
                AppButton(
                  label: 'Save password',
                  loading: _loading,
                  onPressed: _loading ? null : _submit,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.label});

  final TextEditingController controller;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(
            controller: controller,
            obscureText: true,
            decoration: const InputDecoration(hintText: '••••••••'),
          ),
        ],
      ),
    );
  }
}
