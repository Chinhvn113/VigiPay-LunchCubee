import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CreditCard, Loader2 } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await login(username, password);
      
      toast({
        title: "Login Successful",
        description: "Welcome back to Naver Bank!",
      });
      
      // Redirect to home page
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      
      const errorMessage = error.message || "Invalid username or password";
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 md:space-y-8 animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent-green/20 mb-3 md:mb-4">
            <CreditCard className="w-7 h-7 md:w-8 md:h-8 text-accent-green" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Naver Bank</h1>
          <p className="text-sm md:text-base text-muted-foreground px-4">Welcome back! Please login to your account.</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="glass-card rounded-2xl p-6 md:p-8 space-y-5 md:space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm md:text-base">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="transition-all duration-300 focus:scale-[1.01] text-sm md:text-base h-10 md:h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm md:text-base">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10 transition-all duration-300 focus:scale-[1.01] text-sm md:text-base h-10 md:h-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-accent-green hover:bg-accent-green/90 transition-all duration-300 hover:scale-[1.02] h-10 md:h-11 text-sm md:text-base"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>

          <div className="text-center text-sm">
            <button
              type="button"
              className="text-accent-green hover:underline transition-all duration-300"
              onClick={() => {/* Add forgot password logic later */}}
            >
              Forgot password?
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground px-4">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-accent-green hover:underline transition-all duration-300 font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;