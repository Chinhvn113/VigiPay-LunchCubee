import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { User, Save, Loader2, Camera, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useBankAccounts } from "@/hooks/useBankAccount";

const Settings = () => {
  const { user, updateAvatar } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [userName, setUserName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Initialize user data when user or accounts load
  useEffect(() => {
    if (user) {
      setUserName(user.full_name || user.username || "");
      setAvatarPreview(user.avatar_url || null);
    }
  }, [user]);

  // Get main account number
  const mainAccount = accounts?.find(acc => acc.account_type === 'main');
  const accountNumber = mainAccount?.account_number || "";

  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('invalidImageFile') || "Please select a valid image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('imageTooLarge') || "Image size must be less than 2MB");
      return;
    }

    // Read and preview the image
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  // Remove avatar
  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!userName.trim()) {
      toast.error(t('fullNameRequired') || "Full name is required");
      return;
    }

    setIsSaving(true);
    
    try {
      // Save avatar if changed
      if (avatarPreview && avatarPreview !== user?.avatar_url) {
        updateAvatar(avatarPreview);
      }

      // TODO: Implement API call to update user profile (name, etc.)
      // For now, just simulate the save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(t('settingsSaved') || "Settings saved successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error(t('settingsSaveFailed') || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout sidebar={<AppSidebar />}>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
        {/* Header - Removed back button */}
        <div className="mb-6 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('settingsTitle')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{t('manageAccountSettings')}</p>
        </div>

        {/* Settings Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-in">
          {/* Settings Menu */}
          <div className="glass-card rounded-2xl p-4 md:p-6 space-y-2 lg:col-span-1 h-fit">
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-4">{t('menu')}</h3>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 bg-accent/50 hover:bg-accent/70 transition-all duration-300"
            >
              <User className="h-4 w-4" />
              <span className="text-sm md:text-base">{t('profileSettings')}</span>
            </Button>
          </div>

          {/* Profile Settings */}
          <div className="glass-card rounded-2xl p-4 md:p-6 space-y-4 md:space-y-6 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg md:text-xl font-semibold text-foreground">{t('profileSettings')}</h3>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="transition-all duration-300 hover:scale-[1.02] w-full sm:w-auto"
                >
                  {t('editProfile')}
                </Button>
              )}
            </div>

            {/* Loading State */}
            {(!user || accountsLoading) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent-green" />
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {/* Profile Picture */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="relative group">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-accent-green/20 flex items-center justify-center border-2 border-border">
                      {avatarPreview ? (
                        <img 
                          src={avatarPreview} 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl md:text-3xl font-bold text-accent-green">
                          {user?.username?.charAt(0).toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    {isEditing && (
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                      {t('profilePicture') || "Profile Picture"}
                    </p>
                    {isEditing && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="transition-all duration-300 hover:scale-[1.02]"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          {t('changePhoto') || "Change Photo"}
                        </Button>
                        {avatarPreview && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveAvatar}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    {isEditing && (
                      <p className="text-xs text-muted-foreground">
                        {t('avatarHint') || "Max 2MB. JPG, PNG, GIF"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm md:text-base">{t('fullName')}</Label>
                  <Input
                    id="name"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    disabled={!isEditing}
                    placeholder={user?.username || ""}
                    className="transition-all duration-300 focus:scale-[1.01] text-sm md:text-base"
                  />
                </div>

                {/* Email Field (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted/50 text-sm md:text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('emailCannotChange') || "Email cannot be changed"}
                  </p>
                </div>

                {/* Account Number (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="account" className="text-sm md:text-base">{t('accountNumber')}</Label>
                  <Input
                    id="account"
                    type="text"
                    value={accountNumber || (t('noAccountYet') || "No account yet")}
                    disabled
                    className="bg-muted/50 font-mono text-sm md:text-base"
                  />
                  {accountNumber && (
                    <p className="text-xs text-muted-foreground">
                      {t('mainAccountNumber') || "Main account number"}
                    </p>
                  )}
                </div>

                {/* Save/Cancel Buttons */}
                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-accent-green hover:bg-accent-green/90 transition-all duration-300 hover:scale-[1.02] text-sm md:text-base"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('saving') || "Saving..."}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {t('saveChanges') || "Save Changes"}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setUserName(user?.full_name || user?.username || "");
                      }}
                      disabled={isSaving}
                      className="transition-all duration-300 hover:scale-[1.02] text-sm md:text-base"
                    >
                      {t('cancel') || "Cancel"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;