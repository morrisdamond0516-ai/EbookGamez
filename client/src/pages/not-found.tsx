import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BookOpen, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-8xl font-display text-primary/30 mb-4">404</div>
          <h1 className="text-3xl font-display text-white mb-3" data-testid="text-not-found-title">Page Not Found</h1>
          <p className="text-gray-400 font-serif mb-8" data-testid="text-not-found-message">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="gap-2" data-testid="button-not-found-home">
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
            <Link href="/catalog">
              <Button variant="outline" className="gap-2" data-testid="button-not-found-catalog">
                <BookOpen className="w-4 h-4" />
                Browse Catalog
              </Button>
            </Link>
            <Button variant="ghost" className="gap-2" onClick={() => window.history.back()} data-testid="button-not-found-back">
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
