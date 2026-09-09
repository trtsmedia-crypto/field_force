import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_colors.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            height: 66,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            indicatorColor: AppColors.indigoWash,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: (i) => navigationShell.goBranch(
              i,
              initialLocation: i == navigationShell.currentIndex,
            ),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded, color: AppColors.indigo),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.pin_drop_outlined),
                selectedIcon:
                    Icon(Icons.pin_drop_rounded, color: AppColors.indigo),
                label: 'Visits',
              ),
              NavigationDestination(
                icon: Icon(Icons.storefront_outlined),
                selectedIcon:
                    Icon(Icons.storefront_rounded, color: AppColors.indigo),
                label: 'Customers',
              ),
              NavigationDestination(
                icon: Icon(Icons.task_alt_outlined),
                selectedIcon:
                    Icon(Icons.task_alt_rounded, color: AppColors.indigo),
                label: 'Tasks',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon:
                    Icon(Icons.person_rounded, color: AppColors.indigo),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
