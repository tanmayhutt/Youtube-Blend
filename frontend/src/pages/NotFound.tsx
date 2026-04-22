import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-4">
        <div className="mb-6 space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <p className="text-lg text-muted-foreground">Page Not Found</p>
        </div>
        <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or may have been removed.
        </p>
        <Link to="/">
          <Button className="gap-2">
            Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
