import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ScrollProgress } from "@/components/ScrollProgress";
import Index from "./pages/Index";
import Transaction from "./pages/Transaction";
import TransactionConfirmation from "./pages/TransactionConfirmation";
import { SafetyCheckingPage } from "./pages/SafetyCheckingPage"; // Import the new page
import TransactionSuccess from "./pages/TransactionSuccess";
import TransactionHistory from "./pages/TransactionHistory";
import SafetyChecking from "./pages/SafetyChecking";
import AIChat from "./pages/AIChat";
import PhoneTopup from "./pages/PhoneTopup";
import FinancialManagement from "./pages/FinancialManagement";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ScrollProgress />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/safety" element={<ProtectedRoute><SafetyChecking /></ProtectedRoute>} />
              <Route path="/chatbot" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
              <Route path="/transaction" element={<ProtectedRoute><Transaction /></ProtectedRoute>} />
              <Route path="/safety-checking" element={<ProtectedRoute><SafetyCheckingPage /></ProtectedRoute>} />
              <Route path="/transaction-confirmation" element={<ProtectedRoute><TransactionConfirmation /></ProtectedRoute>} />
              <Route path="/transaction-success" element={<ProtectedRoute><TransactionSuccess /></ProtectedRoute>} />
              <Route path="/transaction-history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
              <Route path="/phone-topup" element={<ProtectedRoute><PhoneTopup /></ProtectedRoute>} />
              <Route path="/financial-management" element={<ProtectedRoute><FinancialManagement /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;