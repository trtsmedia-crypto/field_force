import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/attendance/attendance_screen.dart';
import '../features/auth/change_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/customers/customers_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/face/face_enroll_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/tasks/tasks_screen.dart';
import '../features/visits/visits_screen.dart';
import '../state/auth_controller.dart';
import 'app_shell.dart';

/// Rebuilds the router whenever auth state changes, so redirects re-run.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(this._ref) {
    _ref.listen<AuthState>(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable(ref);
  ref.onDispose(listenable.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      return switch (auth.status) {
        AuthStatus.unknown => path == '/splash' ? null : '/splash',
        AuthStatus.signedOut => path == '/login' ? null : '/login',
        AuthStatus.mustChangePassword =>
          path == '/change-password' ? null : '/change-password',
        AuthStatus.needsFace => path == '/face-setup' ? null : '/face-setup',
        AuthStatus.ready => (path == '/splash' ||
                path == '/login' ||
                path == '/change-password' ||
                path == '/face-setup')
            ? '/home'
            : null,
      };
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/change-password',
        builder: (_, __) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: '/face-setup',
        builder: (context, state) => Consumer(
          builder: (context, ref, _) => FaceEnrollScreen(
            onDone: () =>
                ref.read(authControllerProvider.notifier).onFaceEnrolled(),
          ),
        ),
      ),
      GoRoute(
        path: '/attendance',
        builder: (_, __) => const AttendanceScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (_, __) => const DashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/visits', builder: (_, __) => const VisitsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/customers', builder: (_, __) => const CustomersScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/tasks', builder: (_, __) => const TasksScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          ]),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.uri}')),
    ),
  );
});
