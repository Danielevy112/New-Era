import Foundation

/// Pure helpers shared between the app and App Intents.
enum ExpenseHelper {
    static func emoji(for category: String) -> String {
        switch category {
        case "Food & Dining":   return "🍽️"
        case "Transport":       return "🚗"
        case "Shopping":        return "🛍️"
        case "Entertainment":   return "🎬"
        case "Health & Fitness": return "💪"
        case "Bills & Utilities": return "💡"
        case "Travel":          return "✈️"
        case "Groceries":       return "🛒"
        case "Coffee & Drinks": return "☕"
        case "Other":           return "📦"
        default:                return "💳"
        }
    }

    static func formatted(_ amount: Double) -> String {
        String(format: "$%.2f", amount)
    }
}
