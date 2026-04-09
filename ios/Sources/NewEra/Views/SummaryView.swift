import SwiftUI
import SwiftData
import Charts

struct SummaryView: View {
    @Query private var allExpenses: [Expense]
    @State private var selectedMonth: Date = {
        let cal = Calendar.current
        return cal.date(from: cal.dateComponents([.year, .month], from: .now)) ?? .now
    }()

    private var expenses: [Expense] {
        let cal = Calendar.current
        return allExpenses.filter {
            cal.isDate($0.date, equalTo: selectedMonth, toGranularity: .month)
        }
    }

    private var categoryTotals: [(category: String, total: Double)] {
        var map: [String: Double] = [:]
        for e in expenses { map[e.category, default: 0] += e.amount }
        return map.map { (category: $0.key, total: $0.value) }
            .sorted { $0.total > $1.total }
    }

    private var grandTotal: Double {
        expenses.reduce(0) { $0 + $1.amount }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Month picker
                    monthPicker

                    // Total card
                    totalCard

                    if categoryTotals.isEmpty {
                        ContentUnavailableView(
                            "No Data",
                            systemImage: "chart.pie",
                            description: Text("No expenses found for this month.")
                        )
                        .padding(.top, 40)
                    } else {
                        // Bar chart
                        chartCard
                        // Breakdown list
                        breakdownCard
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
            .navigationTitle("Summary")
        }
    }

    // ── Sub-views ─────────────────────────────────────────────────────────────

    private var monthPicker: some View {
        HStack {
            Button {
                selectedMonth = Calendar.current.date(byAdding: .month, value: -1, to: selectedMonth) ?? selectedMonth
            } label: {
                Image(systemName: "chevron.left")
                    .fontWeight(.semibold)
            }

            Spacer()

            Text(selectedMonth.formatted(.dateTime.month(.wide).year()))
                .font(.headline)

            Spacer()

            Button {
                let next = Calendar.current.date(byAdding: .month, value: 1, to: selectedMonth) ?? selectedMonth
                if next <= .now { selectedMonth = next }
            } label: {
                Image(systemName: "chevron.right")
                    .fontWeight(.semibold)
            }
        }
        .padding(14)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var totalCard: some View {
        VStack(spacing: 6) {
            Text("Total Spent")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(ExpenseHelper.formatted(grandTotal))
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundStyle(.red)
            Text("\(expenses.count) transactions")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("By Category")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            Chart(categoryTotals, id: \.category) { item in
                BarMark(
                    x: .value("Amount", item.total),
                    y: .value("Category", item.category)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [.indigo, .purple],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(6)
                .annotation(position: .trailing) {
                    Text(ExpenseHelper.formatted(item.total))
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                }
            }
            .chartXAxis(.hidden)
            .frame(height: CGFloat(categoryTotals.count) * 52)
        }
        .padding(18)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    private var breakdownCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(categoryTotals.enumerated()), id: \.element.category) { index, item in
                HStack(spacing: 14) {
                    Text(ExpenseHelper.emoji(for: item.category))
                        .font(.title3)
                        .frame(width: 36, height: 36)
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.category)
                            .font(.subheadline.weight(.medium))
                        // Percentage bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color(.systemGray5))
                                    .frame(height: 4)
                                Capsule()
                                    .fill(Color.indigo)
                                    .frame(width: geo.size.width * (grandTotal > 0 ? item.total / grandTotal : 0), height: 4)
                            }
                        }
                        .frame(height: 4)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(ExpenseHelper.formatted(item.total))
                            .font(.subheadline.bold())
                            .foregroundStyle(.red)
                        if grandTotal > 0 {
                            Text(String(format: "%.0f%%", item.total / grandTotal * 100))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 16)

                if index < categoryTotals.count - 1 {
                    Divider().padding(.leading, 66)
                }
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }
}
