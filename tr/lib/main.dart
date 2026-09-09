import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/network/api_client.dart';
import 'core/theme/app_theme.dart';
import 'routing/app_router.dart';
import 'state/auth_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: FieldForceApp()));
}

class FieldForceApp extends ConsumerStatefulWidget {
  const FieldForceApp({super.key});

  @override
  ConsumerState<FieldForceApp> createState() => _FieldForceAppState();
}

class _FieldForceAppState extends ConsumerState<FieldForceApp> {
  StreamSubscription<void>? _sessionSub;

  @override
  void initState() {
    super.initState();
    // When a refresh fails deep inside a request, the app has to come back to
    // the sign-in screen rather than sit on a dead page.
    _sessionSub = sessionExpiredStream.stream.listen((_) {
      ref.read(authControllerProvider.notifier).forceSignedOut();
    });
  }

  @override
  void dispose() {
    _sessionSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'FieldForce',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.light,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
