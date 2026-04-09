import Foundation

/// Shared category list, persisted in UserDefaults.
/// Uses an App Group so App Intents (which run out-of-process) can read the same list.
final class CategoryStore: ObservableObject {
    static let shared = CategoryStore()

    private let suite: UserDefaults
    private let key = "newera_categories"

    @Published var categories: [String] = []

    static let defaults: [String] = [
        "Food & Dining",
        "Transport",
        "Shopping",
        "Entertainment",
        "Health & Fitness",
        "Bills & Utilities",
        "Travel",
        "Groceries",
        "Coffee & Drinks",
        "Other"
    ]

    private init() {
        // Falls back to standard if the App Group isn't set up yet (e.g. Simulator without entitlements)
        suite = UserDefaults(suiteName: "group.com.newera.expenses") ?? .standard
        if let saved = suite.stringArray(forKey: key), !saved.isEmpty {
            categories = saved
        } else {
            categories = Self.defaults
            persist()
        }
    }

    func add(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !categories.contains(trimmed) else { return }
        categories.append(trimmed)
        persist()
    }

    func remove(_ name: String) {
        categories.removeAll { $0 == name }
        persist()
    }

    func move(from source: IndexSet, to destination: Int) {
        categories.move(fromOffsets: source, toOffset: destination)
        persist()
    }

    private func persist() {
        suite.set(categories, forKey: key)
    }
}
