import SwiftUI

struct SettingsView: View {
    @StateObject private var store = CategoryStore.shared
    @State private var newCategoryName = ""
    @State private var showingAdd = false

    var body: some View {
        NavigationStack {
            List {
                // ── Categories ──────────────────────────────────────────────
                Section {
                    ForEach(store.categories, id: \.self) { cat in
                        HStack(spacing: 12) {
                            Text(ExpenseHelper.emoji(for: cat))
                            Text(cat)
                        }
                    }
                    .onDelete { store.categories.remove(atOffsets: $0); saveMoved() }
                    .onMove  { store.move(from: $0, to: $1) }
                } header: {
                    Text("Categories")
                } footer: {
                    Text("These appear in the Quick Add screen and in the Shortcuts category picker.")
                }

                // ── Shortcuts tile info ─────────────────────────────────────
                Section("Shortcuts Integration") {
                    Label("Log Expense action is registered", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Label("Open Shortcuts → Automation → + to trigger on payment", systemImage: "info.circle")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { EditButton() }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showingAdd = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAdd) {
                AddCategorySheet(isPresented: $showingAdd)
            }
        }
    }

    private func saveMoved() {
        // CategoryStore.move already persists, this is a no-op placeholder
    }
}

struct AddCategorySheet: View {
    @Binding var isPresented: Bool
    @StateObject private var store = CategoryStore.shared
    @State private var name = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section("Category Name") {
                    TextField("e.g. Subscriptions", text: $name)
                        .focused($focused)
                }
            }
            .navigationTitle("New Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        store.add(name)
                        isPresented = false
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { focused = true }
        }
        .presentationDetents([.medium])
    }
}
