import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to automatically refresh access token before it expires
 * Access token expires in 15 minutes, we'll refresh at 14 minutes
 */
export const useTokenRefresh = () => {
  const { accessToken, refreshAccessToken, isAuthenticated } = useAuth();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only set up refresh timer if user is authenticated
    if (!isAuthenticated || !accessToken) {
      return;
    }

    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Decode JWT to get expiration time
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Refresh 1 minute before expiry (15 min - 1 min = 14 min = 840000 ms)
      const refreshTime = timeUntilExpiry - 60000; // 60000 ms = 1 minute

      if (refreshTime > 0) {
        console.log(`Token will be refreshed in ${Math.round(refreshTime / 1000)} seconds`);
        
        refreshTimerRef.current = setTimeout(async () => {
          console.log('Refreshing access token...');
          try {
            await refreshAccessToken();
            console.log('Access token refreshed successfully');
          } catch (error) {
            console.error('Failed to refresh token:', error);
          }
        }, refreshTime);
      } else {
        // Token is already expired or will expire very soon, refresh immediately
        console.log('Token expired or expiring soon, refreshing now...');
        refreshAccessToken().catch(console.error);
      }
    } catch (error) {
      console.error('Failed to decode token:', error);
    }

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [accessToken, isAuthenticated, refreshAccessToken]);
};
