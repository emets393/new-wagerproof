import FilterableWinRates from "../../components/FilterableWinRates";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function WinRates() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Win Rate Analysis
          </h1>
          
          <Link to="/">
            <Button variant="outline" className="flex items-center gap-2">
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
