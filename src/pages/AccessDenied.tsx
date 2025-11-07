import { useState } from "react";
import Paywall from "@/components/Paywall";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function AccessDenied() {
  const [showPaywall, setShowPaywall] = useState(true);

  if (showPaywall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex flex-col">
        <Paywall showButton={true} />
        
        {/* Back Button */}
        <div className="flex justify-center pb-8">
          <Button variant="outline" asChild>
            <Link to="/home">
              ← Return to Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
