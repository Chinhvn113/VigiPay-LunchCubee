import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { Eye, EyeOff, CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext"; // Import hook

const Register = () => {
  const { t } = useLanguage(); // Use hook
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validations, setValidations] = useState({
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
  });

  const navigate = useNavigate();
  const { register } = useAuth();
  const { toast } = useToast();

  // Real-time password validation
  const validatePassword = (password: string) => {
    setValidations({
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
    });
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Real-time password validation
    if (name === "password") {
      validatePassword(value);
    }

    // Real-time confirm password validation
    if (name === "confirmPassword" && formData.password) {
      if (value !== formData.password) {
        setErrors((prev) => ({ ...prev, confirmPassword: "Passwords do not match" }));
      } else {
        setErrors((prev) => ({ ...prev, confirmPassword: "" }));
      }
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Username validation (3-50 characters)
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (formData.username.length > 50) {
      newErrors.username = "Username must be less than 50 characters";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (!validations.minLength || !validations.hasUpper || !validations.hasLower || !validations.hasNumber) {
      newErrors.password = "Password does not meet requirements";
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: t('validationError'),
        description: t('fixErrors'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.fullName || undefined
      );

      toast({
        title: t('regSuccess'),
        description: t('welcomeMsg'),
      });

      // Redirect to home page
      navigate("/");
    } catch (error: any) {
      console.error("Registration error:", error);
      
      const errorMessage = error.message || t('regFailed');
      
      toast({
        title: t('regFailed'),
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('createAccount')}</h1>
          <p className="text-sm md:text-base text-muted-foreground px-4">
            {t('joinMessage')}
          </p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 md:p-8 space-y-5">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm md:text-base">
              {t('username')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder={t('chooseUsername')}
              value={formData.username}
              onChange={handleChange}
              className={errors.username ? "border-red-500" : ""}
              disabled={isLoading}
            />
            {errors.username && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {errors.username}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm md:text-base">
              {t('email')} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('enterEmail')}
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "border-red-500" : ""}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Full Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm md:text-base">
              {t('fullName')} <span className="text-muted-foreground text-xs">{t('optional')}</span>
            </Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder={t('enterFullName')}
              value={formData.fullName}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm md:text-base">
              {t('password')} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={t('createPassword')}
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? "border-red-500 pr-10" : "pr-10"}
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

            {/* Password Requirements */}
            <div className="space-y-1 text-xs">
              <p className="text-muted-foreground">{t('passwordReqHeader')}</p>
              <div className="flex items-center gap-2">
                {validations.minLength ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={validations.minLength ? "text-green-500" : "text-muted-foreground"}>
                  {t('reqMinChars')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {validations.hasUpper ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={validations.hasUpper ? "text-green-500" : "text-muted-foreground"}>
                  {t('reqUppercase')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {validations.hasLower ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={validations.hasLower ? "text-green-500" : "text-muted-foreground"}>
                  {t('reqLowercase')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {validations.hasNumber ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={validations.hasNumber ? "text-green-500" : "text-muted-foreground"}>
                  {t('reqNumber')}
                </span>
              </div>
            </div>

            {errors.password && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm md:text-base">
              {t('confirmPassword')} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={t('reEnterPassword')}
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full text-primary-foreground bg-accent-green hover:bg-accent-green/90 text-black"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('creatingAccount')}
              </>
            ) : (
              t('createAccountButton')
            )}
          </Button>

          {/* Login Link */}
          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('alreadyHaveAccount')} </span>
            <Link to="/login" className="text-accent-green hover:underline font-medium">
              {t('loginHere')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
