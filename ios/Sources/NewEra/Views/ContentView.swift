import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            QuickAddView()
                .tabItem {
                    Label("Add", systemImage: "plus.circle.fill")
                }

            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }

            SummaryView()
                .tabItem {
                    Label("Summary", systemImage: "chart.pie.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .preferredColorScheme(.dark)
    }
}
