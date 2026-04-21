import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import TokenHandler from "./pages/TokenHandler";
import AuthComplete from "./pages/AuthComplete";
import Dashboard from "./pages/Dashboard";
import CompareJoin from "./pages/CompareJoin";
import CompareFinalise from "./pages/CompareFinalise";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TokenHandler />} />
          <Route path="/auth/complete" element={<AuthComplete />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/compare/join/:id" element={<CompareJoin />} />
          <Route path="/compare/finalise/:id" element={<CompareFinalise />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
