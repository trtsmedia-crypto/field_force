import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_spacing.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData get light {
    final base = ThemeData(brightness: Brightness.light, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.canvas,
      colorScheme: const ColorScheme.light(
        primary: AppColors.indigo,
        onPrimary: Colors.white,
        secondary: AppColors.duty,
        onSecondary: Colors.white,
        surface: AppColors.card,
        onSurface: AppColors.text,
        error: AppColors.danger,
      ),
      textTheme: _textTheme(base.textTheme, AppColors.text),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: TextStyle(
          color: AppColors.text,
          fontSize: 19,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: AppColors.text),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: AppColors.muted, fontSize: 15),
        border: _border(AppColors.line),
        enabledBorder: _border(AppColors.line),
        focusedBorder: _border(AppColors.indigo, width: 1.6),
        errorBorder: _border(AppColors.danger),
        focusedErrorBorder: _border(AppColors.danger, width: 1.6),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.line,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: AppColors.ink,
        contentTextStyle: TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  static ThemeData get dark {
    final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.ink,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.indigo,
        onPrimary: Colors.white,
        secondary: AppColors.duty,
        surface: AppColors.inkSoft,
        onSurface: Colors.white,
        error: AppColors.danger,
      ),
      textTheme: _textTheme(base.textTheme, Colors.white),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 19,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  static OutlineInputBorder _border(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  static TextTheme _textTheme(TextTheme base, Color color) {
    return base
        .copyWith(
          headlineMedium: base.headlineMedium
              ?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.8),
          headlineSmall: base.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
          titleLarge: base.titleLarge
              ?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.4),
          titleMedium: base.titleMedium
              ?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.2),
          bodyMedium: base.bodyMedium?.copyWith(height: 1.45),
          labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        )
        .apply(bodyColor: color, displayColor: color);
  }
}
