
import FilterableWinRates from "@/components/FilterableWinRates";

export default function WinRates() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Win Rate Analysis
          </h1>
          

        </div>

        <FilterableWinRates />
      </div>
    </div>
  );
}
