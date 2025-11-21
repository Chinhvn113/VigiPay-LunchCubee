import { useAuth } from "@/contexts/AuthContext";
import { User } from "lucide-react";

export const WelcomeBanner = () => {
  const { user } = useAuth();

  // Get user's display name
  const displayName = user?.full_name || user?.username || "Quý khách";
  
  // Get first letter for avatar fallback
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="mb-6 flex items-center gap-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {user?.avatar_url ? (
          <img 
            src={user.avatar_url} 
            alt={displayName}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-primary/20"
          />
        ) : (
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
            <span className="text-lg md:text-xl font-semibold text-primary">
              {avatarLetter}
            </span>
          </div>
        )}
      </div>
      
      {/* Welcome Text */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Chào mừng, <span className="text-primary">{displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chúc bạn một ngày làm việc hiệu quả
        </p>
      </div>
    </div>
  );
};
