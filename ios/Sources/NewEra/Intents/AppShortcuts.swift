import AppIntents

/// Registers pre-built shortcuts so they appear immediately in the
/// Shortcuts app under "New Era" — no user configuration needed.
struct NewEraShortcuts: AppShortcutsProvider {

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogExpenseIntent(),
            phrases: [
                "Log expense in \(.applicationName)",
                "Add payment to \(.applicationName)",
                "Track spending in \(.applicationName)",
                "Record purchase in \(.applicationName)"
            ],
            shortTitle: "Log Expense",
            systemImageName: "creditcard.fill"
        )
    }

    // Accent color shown in the Shortcuts app tile
    static var shortcutTileColor: ShortcutTileColor = .indigo
}
