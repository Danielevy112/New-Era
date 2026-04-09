import SwiftUI
import SwiftData

struct HistoryView: View {
    @Query(sort: \Expense.date, order: .reverse) private var expenses: [Expense]
    @Environment(\.modelContext) private var modelContext

    @State private var searchText = ""

    private var filtered: [Expense] {
        guard !searchText.isEmpty else { return expenses }
        let q = searchText.lowercased()
        return expenses.filter {
            $0.category.lowercased().contains(q) ||
            $0.note.lowercased().contains(q) ||
            $0.merchant.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if expenses.isEmpty {
                    ContentUnavailableView(
                        "No Expenses Yet",
                        systemImage: "creditcard",
                        description: Text("Log your first expense manually or via the Shortcuts automation.")
                    )
                } else {
                    List {
                        ForEach(filtered) { expense in
                            ExpenseRow(expense: expense)
                        }
                        .onDelete(perform: delete)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("History")
            .searchable(text: $searchText, prompt: "Search expenses…")
            .toolbar {
                if !expenses.isEmpty {
                    EditButton()
                }
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(filtered[index])
        }
    }
}

struct ExpenseRow: View {
    let expense: Expense

    var body: some View {
        HStack(spacing: 14) {
            // Icon
            Text(ExpenseHelper.emoji(for: expense.category))
                .font(.title2)
                .frame(width: 46, height: 46)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))

            // Info
            VStack(alignment: .leading, spacing: 3) {
                Text(expense.category)
                    .font(.subheadline.weight(.semibold))

                let meta = [expense.merchant, expense.note]
                    .filter { !$0.isEmpty }
                    .joined(separator: " · ")
                if !meta.isEmpty {
                    Text(meta)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Text(expense.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            Text("-\(ExpenseHelper.formatted(expense.amount))")
                .font(.subheadline.bold())
                .foregroundStyle(.red)
        }
        .padding(.vertical, 4)
    }
}
