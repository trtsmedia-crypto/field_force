import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/async_view.dart';
import '../../state/data_providers.dart';
import 'add_customer_screen.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(customersProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.screen, 0, AppSpacing.screen, 12),
            child: TextField(
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Search by shop or area',
                prefixIcon: Icon(Icons.search_rounded,
                    size: 21, color: AppColors.muted),
              ),
            ),
          ),
          Expanded(
            child: AsyncView<List<Customer>>(
              value: async,
              onRetry: () => ref.invalidate(customersProvider(_query)),
              isEmpty: (data) => data.isEmpty,
              emptyTitle: _query.isEmpty
                  ? 'No customers assigned yet'
                  : 'No match for "$_query"',
              emptyMessage: _query.isEmpty
                  ? 'Your manager assigns customers to you. They will appear here.'
                  : 'Try a different shop name or area.',
              builder: (customers) => RefreshIndicator(
                onRefresh: () async =>
                    ref.invalidate(customersProvider(_query)),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.screen, 4, AppSpacing.screen, 32),
                  itemCount: customers.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, i) =>
                      _CustomerCard(customer: customers[i]),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const AddCustomerScreen()),
          );
          if (created == true) {
            ref.invalidate(customersProvider(_query));
          }
        },
        backgroundColor: AppColors.indigo,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add customer'),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.customer});

  final Customer customer;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => _openSheet(context),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.indigoWash,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              customer.initials,
              style: const TextStyle(
                  color: AppColors.indigoDeep, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer.businessName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 3),
                Text(
                  [customer.area, customer.category]
                      .where((s) => s != null && s.isNotEmpty)
                      .join(' · '),
                  style:
                  const TextStyle(fontSize: 12.5, color: AppColors.muted),
                ),
                if (customer.outstanding > 0) ...[
                  const SizedBox(height: 7),
                  Text(
                    '${formatCurrency(customer.outstanding)} outstanding',
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.danger,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded,
              size: 20, color: AppColors.muted),
        ],
      ),
    );
  }

  void _openSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.screen, 0, AppSpacing.screen, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(customer.businessName,
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              [customer.category, customer.area, customer.city]
                  .where((s) => s != null && s.isNotEmpty)
                  .join(' · '),
              style: const TextStyle(color: AppColors.muted, fontSize: 13.5),
            ),
            const SizedBox(height: 20),
            if (customer.contactName != null)
              _DetailRow(
                  icon: Icons.person_outline, value: customer.contactName!),
            if (customer.phone != null)
              _DetailRow(icon: Icons.call_outlined, value: customer.phone!),
            _DetailRow(
              icon: Icons.history_outlined,
              value: customer.lastVisit == null
                  ? 'Never visited'
                  : 'Last visited ${formatDay(customer.lastVisit!)}',
            ),
            _DetailRow(
              icon: Icons.account_balance_wallet_outlined,
              value: customer.outstanding == 0
                  ? 'No outstanding balance'
                  : '${formatCurrency(customer.outstanding)} outstanding',
            ),
            _DetailRow(
              icon: Icons.my_location_outlined,
              value: customer.latitude == null
                  ? 'Location not set — check-in may not work here'
                  : 'Check-in radius ${customer.geofenceRadius} m',
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.muted),
          const SizedBox(width: 12),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}