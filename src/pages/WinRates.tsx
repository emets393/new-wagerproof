import FilterableWinRates from "@/components/FilterableWinRates";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Home, TrendingUp } from "lucide-react";

export default function WinRates() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent rounded-xl shadow-lg">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-accent drop-shadow-lg">Win Rate Analysis</h1>
              <p className="text-white/80 mt-1 font-medium">Analyze historical performance patterns</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2 bg-white/80 text-primary border-accent hover:bg-accent/10">
              <Home className="w-4 h-4" />
              Today's Games
            </Button>
          </Link>
        </div>
        <FilterableWinRates />
      </div>
    </div>
  );
}
