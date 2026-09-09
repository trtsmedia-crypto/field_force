import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/widgets/app_button.dart';
import 'face_capture_screen.dart';
import 'face_service.dart';

/// One-time face registration, shown after first sign-in.
///
/// The consent step is not decoration: a face template is biometric data, and
/// the employee is told what is stored and why before anything is captured.
class FaceEnrollScreen extends ConsumerStatefulWidget {
  const FaceEnrollScreen({super.key, this.onDone});

  final VoidCallback? onDone;

  @override
  ConsumerState<FaceEnrollScreen> createState() => _FaceEnrollScreenState();
}

class _FaceEnrollScreenState extends ConsumerState<FaceEnrollScreen> {
  bool _consent = false;
  bool _busy = false;
  String? _error;

  Future<void> _enroll() async {
    if (!_consent) {
      setState(() => _error = 'Please accept before registering your face.');
      return;
    }

    final result = await Navigator.of(context).push<FaceResult>(
      MaterialPageRoute(
        builder: (_) => const FaceCaptureScreen(
          title: 'Register your face',
          instruction:
              'Look straight at the camera in even light.\n'
              'This one photo becomes your reference for every future check.',
        ),
      ),
    );
    if (result == null || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await api.post('/face/enroll', data: {
        'embedding': result.embedding,
        'selfie': result.jpegBase64,
        'consent': true,
        'device': 'Mobile app',
      });
      if (!mounted) return;
      widget.onDone?.call();
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Face registration')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen, 8, AppSpacing.screen, AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: AppColors.indigoWash,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.face_retouching_natural,
                    color: AppColors.indigo, size: 30),
              ),
              const SizedBox(height: 22),
              Text(
                'Register your face once',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 10),
              const Text(
                'From then on, starting and ending duty asks for a quick selfie '
                'so your attendance is recorded as yours.',
                style: TextStyle(
                    color: AppColors.muted, fontSize: 14.5, height: 1.5),
              ),
              const SizedBox(height: 26),
              const _Point(
                icon: Icons.tag_outlined,
                title: 'A pattern, not a photo album',
                body:
                    'Your face is stored as a set of numbers. Those numbers '
                    'cannot be turned back into a picture of you.',
              ),
              const _Point(
                icon: Icons.schedule_outlined,
                title: 'Only at duty start and end',
                body:
                    'The camera is used at those two moments. It is not running '
                    'in the background.',
              ),
              const _Point(
                icon: Icons.visibility_outlined,
                title: 'Your manager can see the checks',
                body:
                    'Each check is saved with its selfie and score, so a failed '
                    'check can be reviewed by a person rather than just refused.',
              ),
              const SizedBox(height: 20),
              InkWell(
                onTap: () => setState(() {
                  _consent = !_consent;
                  _error = null;
                }),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _consent ? AppColors.indigoWash : Colors.white,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    border: Border.all(
                      color: _consent ? AppColors.indigo : AppColors.line,
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        _consent
                            ? Icons.check_box_rounded
                            : Icons.check_box_outline_blank_rounded,
                        color: _consent ? AppColors.indigo : AppColors.muted,
                        size: 22,
                      ),
                      const SizedBox(width: 11),
                      const Expanded(
                        child: Text(
                          'I understand my face pattern will be stored and used '
                          'to confirm my attendance.',
                          style: TextStyle(fontSize: 13.5, height: 1.45),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: AppColors.dangerWash,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                        color: AppColors.danger, fontSize: 13, height: 1.4),
                  ),
                ),
              ],
              const SizedBox(height: 22),
              AppButton(
                label: 'Register my face',
                icon: Icons.camera_alt_outlined,
                loading: _busy,
                onPressed: _busy ? null : _enroll,
              ),
              const SizedBox(height: 12),
              const Center(
                child: Text(
                  'If a check ever fails, your manager can reset this.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: AppColors.indigo),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 14.5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 3),
                Text(body,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.muted, height: 1.45)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
