import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../features/tracking/location_service.dart';
import '../../shared/widgets/app_button.dart';
import '../../state/data_providers.dart';

/// Lets a field employee add a shop they've found on their route.
/// New customers are assigned to whoever creates them — the server enforces
/// that, this screen doesn't need to ask who it belongs to.
class AddCustomerScreen extends ConsumerStatefulWidget {
  const AddCustomerScreen({super.key});

  @override
  ConsumerState<AddCustomerScreen> createState() => _AddCustomerScreenState();
}

class _AddCustomerScreenState extends ConsumerState<AddCustomerScreen> {
  final _businessName = TextEditingController();
  final _contactName = TextEditingController();
  final _phone = TextEditingController();
  final _area = TextEditingController();
  final _category = TextEditingController();

  double? _latitude;
  double? _longitude;
  bool _locating = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _businessName.dispose();
    _contactName.dispose();
    _phone.dispose();
    _area.dispose();
    _category.dispose();
    super.dispose();
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    final fix = await LocationService.currentFix();
    if (!mounted) return;
    setState(() {
      _locating = false;
      if (fix != null) {
        _latitude = fix.latitude;
        _longitude = fix.longitude;
        if (_area.text.isEmpty && fix.address != null) {
          _area.text = fix.address!;
        }
      } else {
        _error = 'Could not get your location. Turn on GPS and try again.';
      }
    });
  }

  Future<void> _save() async {
    if (_businessName.text.trim().isEmpty) {
      setState(() => _error = 'Enter the business name.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await api.post('/customers', data: {
        'businessName': _businessName.text.trim(),
        if (_contactName.text.trim().isNotEmpty)
          'contactName': _contactName.text.trim(),
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        if (_area.text.trim().isNotEmpty) 'area': _area.text.trim(),
        if (_category.text.trim().isNotEmpty)
          'category': _category.text.trim(),
        if (_latitude != null) 'latitude': _latitude,
        if (_longitude != null) 'longitude': _longitude,
      });

      ref.invalidate(customersProvider(''));
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on AppException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add customer')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen, 8, AppSpacing.screen, AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'This customer will be assigned to you automatically.',
                style: TextStyle(color: AppColors.muted, fontSize: 13.5),
              ),
              const SizedBox(height: 22),
              if (_error != null) ...[
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
                const SizedBox(height: 18),
              ],
              _Field(
                label: 'Business name',
                controller: _businessName,
                hint: 'e.g. Sharma Medical Store',
              ),
              _Field(
                label: 'Contact name',
                controller: _contactName,
                hint: 'Owner or manager',
              ),
              _Field(
                label: 'Phone',
                controller: _phone,
                hint: '+91',
                keyboardType: TextInputType.phone,
              ),
              _Field(
                label: 'Area',
                controller: _area,
                hint: 'Locality or address',
              ),
              _Field(
                label: 'Category',
                controller: _category,
                hint: 'e.g. Retail Pharmacy',
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _latitude != null
                      ? AppColors.successWash
                      : AppColors.indigoWash,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Row(
                  children: [
                    Icon(
                      _latitude != null
                          ? Icons.check_circle_outline
                          : Icons.my_location_outlined,
                      size: 19,
                      color: _latitude != null
                          ? AppColors.success
                          : AppColors.indigo,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        _latitude != null
                            ? 'Location captured'
                            : 'Location helps check-in work here later',
                        style: TextStyle(
                          fontSize: 13,
                          color: _latitude != null
                              ? AppColors.success
                              : AppColors.indigoDeep,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: _locating ? null : _useCurrentLocation,
                      child: Text(_locating
                          ? 'Locating…'
                          : _latitude != null
                          ? 'Update'
                          : 'Use my location'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 26),
              AppButton(
                label: 'Save customer',
                loading: _saving,
                onPressed: _saving ? null : _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.hint,
    this.keyboardType,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13.5, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(
            controller: controller,
            keyboardType: keyboardType,
            decoration: InputDecoration(hintText: hint),
          ),
        ],
      ),
    );
  }
}