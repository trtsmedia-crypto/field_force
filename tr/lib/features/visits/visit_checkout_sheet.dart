import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/widgets/app_button.dart';

/// Collects what happened during the visit before it is closed.
class VisitCheckoutSheet extends StatefulWidget {
  const VisitCheckoutSheet({super.key, required this.customerName});

  final String customerName;

  @override
  State<VisitCheckoutSheet> createState() => _VisitCheckoutSheetState();
}

class _VisitCheckoutSheetState extends State<VisitCheckoutSheet> {
  final _discussion = TextEditingController();
  final _order = TextEditingController();
  final _notes = TextEditingController();
  DateTime? _followUp;

  @override
  void dispose() {
    _discussion.dispose();
    _order.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickFollowUp() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _followUp = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.screen, 0, AppSpacing.screen,
          MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Close visit',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              widget.customerName,
              style: const TextStyle(color: AppColors.muted, fontSize: 13.5),
            ),
            const SizedBox(height: 20),
            const _Label('What was discussed'),
            TextField(
              controller: _discussion,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Stock levels, new scheme, complaint…',
              ),
            ),
            const SizedBox(height: 16),
            const _Label('Order value (optional)'),
            TextField(
              controller: _order,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                hintText: '0',
                prefixText: '₹ ',
              ),
            ),
            const SizedBox(height: 16),
            const _Label('Next follow-up'),
            InkWell(
              onTap: _pickFollowUp,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(color: AppColors.line),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.event_outlined,
                        size: 19, color: AppColors.muted),
                    const SizedBox(width: 12),
                    Text(
                      _followUp == null
                          ? 'Not set'
                          : '${_followUp!.day}/${_followUp!.month}/${_followUp!.year}',
                      style: TextStyle(
                        fontSize: 15,
                        color: _followUp == null
                            ? AppColors.muted
                            : AppColors.text,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const _Label('Notes (optional)'),
            TextField(
              controller: _notes,
              maxLines: 2,
              decoration: const InputDecoration(hintText: 'Anything else'),
            ),
            const SizedBox(height: 22),
            AppButton(
              label: 'Complete visit',
              onPressed: () {
                Navigator.pop(context, {
                  if (_discussion.text.trim().isNotEmpty)
                    'discussion': _discussion.text.trim(),
                  if (_order.text.trim().isNotEmpty)
                    'orderAmount': int.tryParse(_order.text.trim()) ?? 0,
                  if (_followUp != null)
                    'nextFollowupDate':
                        _followUp!.toIso8601String().substring(0, 10),
                  if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
                });
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
    );
  }
}
