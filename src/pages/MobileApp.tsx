import { Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MobileApp() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30 mb-4">
          <Smartphone className="w-10 h-10 text-honeydew-600 dark:text-honeydew-400" />
        </div>
        
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold mb-2">iOS/Android App</CardTitle>
            <CardDescription className="text-lg">
              We're almost complete with development!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground text-base leading-relaxed">
              Our mobile apps are currently in the final stages of development. 
              Stay tuned for updates!
            </p>
            <p className="text-muted-foreground text-base leading-relaxed">
              In the meantime the site is fully optimized for mobile devices 
              but will provide an even better native mobile experience on iOS and Android soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

