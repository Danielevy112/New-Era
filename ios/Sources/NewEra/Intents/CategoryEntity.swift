import AppIntents

/// A spending category exposed as a typed App Intent entity.
/// This lets the Shortcuts parameter UI show a searchable picker of your categories.
struct CategoryEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Category")
    static var defaultQuery = CategoryQuery()

    var id: String      // category name is the stable ID
    var name: String

    init(name: String) {
        self.id = name
        self.name = name
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(ExpenseHelper.emoji(for: name))"
        )
    }
}

struct CategoryQuery: EntityQuery {
    /// Called when Shortcuts resolves a stored category ID back to a full entity.
    func entities(for identifiers: [String]) async throws -> [CategoryEntity] {
        CategoryStore.shared.categories
            .filter { identifiers.contains($0) }
            .map { CategoryEntity(name: $0) }
    }

    /// Called to populate the picker list when the user taps the parameter.
    func suggestedEntities() async throws -> [CategoryEntity] {
        CategoryStore.shared.categories.map { CategoryEntity(name: $0) }
    }
}
