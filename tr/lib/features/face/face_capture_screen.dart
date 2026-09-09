import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../core/permissions/permission_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/widgets/app_button.dart';
import 'face_service.dart';

/// Full-screen selfie capture used for both registration and the duty check.
///
/// Pops with a [FaceResult] on success, or null if the user backs out.
class FaceCaptureScreen extends StatefulWidget {
  const FaceCaptureScreen({
    super.key,
    required this.title,
    required this.instruction,
  });

  final String title;
  final String instruction;

  @override
  State<FaceCaptureScreen> createState() => _FaceCaptureScreenState();
}

class _FaceCaptureScreenState extends State<FaceCaptureScreen> {
  CameraController? _controller;
  String? _error;
  bool _busy = false;
  bool _starting = true;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    final permission = await PermissionService.requestCamera();
    if (!mounted) return;

    if (permission != PermissionOutcome.granted) {
      setState(() {
        _starting = false;
        _error = permission == PermissionOutcome.permanentlyDenied
            ? 'Camera access is blocked. Turn it on in Settings to mark attendance.'
            : 'Camera access is needed to check your face.';
      });
      return;
    }

    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await controller.initialize();
      if (!mounted) return;
      setState(() {
        _controller = controller;
        _starting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _starting = false;
        _error = 'The camera could not be opened on this device.';
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final picture = await controller.takePicture();
      final result = await FaceService.instance.process(picture);
      if (!mounted) return;
      Navigator.of(context).pop(result);
    } on FaceFailure catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'The face scan failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      appBar: AppBar(
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        title: Text(
          widget.title,
          style: const TextStyle(color: Colors.white, fontSize: 17),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: _starting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : _controller == null
                        ? _PermissionMessage(message: _error ?? 'Camera unavailable')
                        : _Preview(controller: _controller!),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.screen, AppSpacing.lg, AppSpacing.screen, AppSpacing.xl),
              child: Column(
                children: [
                  Text(
                    widget.instruction,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFD7DBEC),
                      fontSize: 14,
                      height: 1.45,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.error_outline,
                              size: 17, color: AppColors.danger),
                          const SizedBox(width: 9),
                          Expanded(
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                color: Color(0xFFFFC9CB),
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  if (_controller != null)
                    AppButton(
                      label: _busy ? 'Checking…' : 'Capture',
                      icon: Icons.camera_alt_outlined,
                      loading: _busy,
                      tone: AppButtonTone.duty,
                      onPressed: _capture,
                    )
                  else if (_error != null)
                    AppButton(
                      label: 'Open settings',
                      onPressed: PermissionService.openSettings,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Preview extends StatelessWidget {
  const _Preview({required this.controller});

  final CameraController controller;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: SizedBox(
            width: 300,
            height: 400,
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: controller.value.previewSize?.height ?? 300,
                height: controller.value.previewSize?.width ?? 400,
                child: CameraPreview(controller),
              ),
            ),
          ),
        ),
        IgnorePointer(
          child: Container(
            width: 300,
            height: 400,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

class _PermissionMessage extends StatelessWidget {
  const _PermissionMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.no_photography_outlined,
              size: 40, color: Color(0xFF9AA3C7)),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFD7DBEC), height: 1.5),
          ),
        ],
      ),
    );
  }
}
