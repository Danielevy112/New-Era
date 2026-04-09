import SwiftUI
import SwiftData

struct QuickAddView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var store = CategoryStore.shared

    @State private var amountText = ""
    @State private var selectedCategory: String?
    @State private var note = ""
    @State private var showSuccess = false
    @FocusState private var amountFocused: Bool

    private let columns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ]

    var canSave: Bool {
        guard let amt = Double(amountText), amt > 0, selectedCategory != nil else { return false }
        return true
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    amountSection
                    categorySection
                    noteSection
                    saveButton
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .navigationTitle("New Era")
            .navigationBarTitleDisplayMode(.large)
            .onAppear { amountFocused = true }
        }
        .overlay {
            if showSuccess { SuccessOverlay() }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: showSuccess)
    }

    // ── Sections ─────────────────────────────────────────────────────────────

    private var amountSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Amount", systemImage: "dollarsign.circle")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("$")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)

                TextField("0.00", text: $amountText)
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .keyboardType(.decimalPad)
                    .focused($amountFocused)
                    .tint(.indigo)
            }
            .padding(18)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Category", systemImage: "tag")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(store.categories, id: \.self) { cat in
                    CategoryTile(
                        name: cat,
                        isSelected: selectedCategory == cat
                    ) {
                        withAnimation(.spring(response: 0.2)) {
                            selectedCategory = cat
                        }
                        amountFocused = false
                    }
                }
            }
        }
    }

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Note (optional)", systemImage: "text.bubble")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            TextField("Merchant, store, note…", text: $note)
                .padding(14)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .tint(.indigo)
        }
    }

    private var saveButton: some View {
        Button(action: save) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                Text("Log Expense")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(16)
            .background(canSave ? Color.indigo : Color.gray.opacity(0.4))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .disabled(!canSave)
        .animation(.easeInOut(duration: 0.15), value: canSave)
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    private func save() {
        guard let amount = Double(amountText), let category = selectedCategory else { return }
        let expense = Expense(amount: amount, category: category, note: note)
        modelContext.insert(expense)

        withAnimation { showSuccess = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation { showSuccess = false }
            amountText = ""
            selectedCategory = nil
            note = ""
            amountFocused = true
        }
    }
}

// ── Supporting views ──────────────────────────────────────────────────────────

struct CategoryTile: View {
    let name: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text(ExpenseHelper.emoji(for: name))
                    .font(.title2)
                Text(shortName)
                    .font(.caption2.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(isSelected ? Color.indigo : Color(.systemGray6))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? Color.indigo.opacity(0.8) : .clear, lineWidth: 2)
            )
            .scaleEffect(isSelected ? 0.96 : 1)
        }
    }

    private var shortName: String {
        // Shorten long names for the tile
        name.replacingOccurrences(of: " & ", with: " &\n")
    }
}

struct SuccessOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.green)
                Text("Logged!")
                    .font(.title.bold())
            }
            .padding(48)
            .background(.ultraThickMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 28))
        }
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }
}
