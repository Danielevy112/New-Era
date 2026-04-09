import Foundation
import SwiftData

@Model
class Expense {
    var id: UUID
    var amount: Double
    var category: String
    var note: String
    var merchant: String
    var date: Date

    init(
        amount: Double,
        category: String,
        note: String = "",
        merchant: String = "",
        date: Date = .now
    ) {
        self.id = UUID()
        self.amount = amount
        self.category = category
        self.note = note
        self.merchant = merchant
        self.date = date
    }
}
