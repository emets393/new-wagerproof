import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            The free launch period has ended. A subscription is required to continue using WagerProof.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link to="/home">Return to Home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/account">Manage Account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
