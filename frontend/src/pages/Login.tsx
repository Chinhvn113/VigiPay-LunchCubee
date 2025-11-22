import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components//ui/use-toast";
import { Eye, EyeOff, CreditCard, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const Login = () => {
  const { t } = useLanguage();
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
        title: t('validationError'),
        description: t('enterBothFields'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await login(username, password);
      
      toast({
        title: t('loginSuccess'),
        description: t('welcomeBackMsg'),
      });
      
      // Redirect to home page
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: t('loginFailed'),
        description: error.message || t('invalidCredentials'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-green/20 mb-4">
            <CreditCard className="w-8 h-8 text-accent-green" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t('loginTitle')}</h1>
          <p className="text-muted-foreground">
            {t('loginSubtitle')}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="glass-card rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">{t('username')}</Label>
            <Input
              id="username"
              type="text"
              placeholder={t('chooseUsername')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('password')}</Label>
              {/* <Link 
                to="/forgot-password" 
                className="text-xs text-accent-green hover:underline"
              >
                {t('forgotPassword')}
              </Link> */}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full text-primary-foreground bg-accent-green hover:bg-accent-green/90 text-black"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loggingIn')}
              </>
            ) : (
              t('loginButton')
            )}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('noAccount')} </span>
            <Link to="/register" className="text-accent-green hover:underline font-medium">
              {t('signUp')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;