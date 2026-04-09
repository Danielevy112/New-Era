import AppIntents
import SwiftData

/// The core App Intent — appears as a native tile in the Shortcuts app
/// once New Era is installed. No user setup required.
///
/// Automation flow:
///   Automation trigger (e.g. "Transaction detected") → LogExpenseIntent
///   → Siri/Shortcuts prompts for Amount + Category → expense saved → confirmation.
struct LogExpenseIntent: AppIntent {

    static var title: LocalizedStringResource = "Log Expense"

    static var description = IntentDescription(
        "Log a payment to New Era by choosing a category and entering the amount. " +
        "Use this in a Shortcuts automation so it fires automatically every time you pay.",
        categoryName: "Finance",
        searchKeywords: ["expense", "payment", "spend", "finance", "money", "track"]
    )

    // Run silently in the background — no need to open the app.
    static var openAppWhenRun: Bool = false

    // ── Parameters ──────────────────────────────────────────────────────────

    @Parameter(
        title: "Amount",
        description: "How much did you pay?",
        requestValueDialog: IntentDialog("How much did you pay?")
    )
    var amount: Double

    @Parameter(
        title: "Category",
        description: "What did you spend on?",
        requestValueDialog: IntentDialog("Choose a category")
    )
    var category: CategoryEntity

    @Parameter(
        title: "Note",
        description: "Merchant name or short note (optional)",
        default: "",
        requestValueDialog: IntentDialog("Any note or merchant? (optional)")
    )
    var note: String

    // ── Perform ─────────────────────────────────────────────────────────────

    @MainActor
    func perform() async throws -> some ProvidesDialog & ReturnsValue<String> {
        let container = try ModelContainer(for: Expense.self)
        let context = container.mainContext

        let expense = Expense(
            amount: amount,
            category: category.name,
            note: note
        )
        context.insert(expense)
        try context.save()

        let summary = "\(ExpenseHelper.emoji(for: category.name)) \(ExpenseHelper.formatted(amount)) logged under \(category.name)."

        return .result(
            value: summary,
            dialog: IntentDialog(stringLiteral: summary)
        )
    }
}
