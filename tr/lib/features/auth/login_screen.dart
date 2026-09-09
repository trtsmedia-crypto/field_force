import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/widgets/app_button.dart';
import '../../state/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _userController = TextEditingController();
  final _passController = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _userController.dispose();
    _passController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ref.read(authControllerProvider.notifier).signIn(
            _userController.text.trim(),
            _passController.text,
          );
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Sign-in failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen, 40, AppSpacing.screen, AppSpacing.screen),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.indigo, AppColors.duty],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.explore_outlined,
                      color: Colors.white, size: 27),
                ),
                const SizedBox(height: 28),
                Text(
                  'Sign in to start your day',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Use the employee ID and password your admin gave you.',
                  style: TextStyle(
                      color: AppColors.muted, fontSize: 14.5, height: 1.45),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 22),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.dangerWash,
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.error_outline,
                            size: 18, color: AppColors.danger),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _error!,
                            style: const TextStyle(
                                color: AppColors.danger,
                                fontSize: 13.5,
                                height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 28),
                const _FieldLabel('Employee ID or mobile'),
                TextFormField(
                  controller: _userController,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    hintText: 'EMP-1042',
                    prefixIcon: Icon(Icons.badge_outlined,
                        size: 20, color: AppColors.muted),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Enter your employee ID'
                      : null,
                ),
                const SizedBox(height: 18),
                const _FieldLabel('Password'),
                TextFormField(
                  controller: _passController,
                  obscureText: _obscure,
                  onFieldSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    hintText: 'Enter password',
                    prefixIcon: const Icon(Icons.lock_outline,
                        size: 20, color: AppColors.muted),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        size: 20,
                        color: AppColors.muted,
                      ),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) => (v == null || v.isEmpty)
                      ? 'Enter your password'
                      : null,
                ),
                const SizedBox(height: 24),
                AppButton(
                  label: 'Sign in',
                  loading: _loading,
                  onPressed: _loading ? null : _submit,
                ),
                const SizedBox(height: 28),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.indigoWash,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.shield_outlined,
                          size: 18, color: AppColors.indigoDeep),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Your location is shared only between starting and '
                          'ending duty, and only if your admin has enabled '
                          'tracking for you.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.indigoDeep,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: AppColors.text,
        ),
      ),
    );
  }
}
